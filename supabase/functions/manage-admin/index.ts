import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { getSupabaseSecretKey } from "../_shared/supabase-key.ts";

const DEFAULT_ORIGINS = [
  "https://thelogos.dev",
  "https://www.thelogos.dev",
  "http://127.0.0.1:1313",
  "http://localhost:1313",
];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ORIGINS);
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || DEFAULT_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const origins = allowedOrigins();
  if (origin && !origins.has(origin)) return json(403, { error: "허용되지 않은 요청 경로입니다." }, DEFAULT_ORIGINS[0]);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(405, { error: "POST 요청만 지원합니다." }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getSupabaseSecretKey();
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: "Admin 관리 기능이 준비되지 않았습니다." }, origin);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "Admin 로그인이 필요합니다." }, origin);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await service.auth.getUser(authorization.slice("Bearer ".length));
  if (authError || !authData.user) return json(401, { error: "Admin 세션이 만료되었습니다." }, origin);

  const { data: caller, error: callerError } = await service
    .from("admin_profiles")
    .select("user_id, display_name, role, active")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .single();
  if (callerError || caller?.role !== "owner") return json(403, { error: "대표 관리자 권한이 필요합니다." }, origin);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json(400, { error: "요청 내용을 읽을 수 없습니다." }, origin);
  }

  const action = normalizeText(input.action);
  if (action === "list") {
    const { data: profiles, error } = await service
      .from("admin_profiles")
      .select("user_id, display_name, role, active, created_at, updated_at")
      .order("created_at");
    if (error) return json(503, { error: "Admin 목록을 불러오지 못했습니다." }, origin);

    const { data: usersData } = await service.auth.admin.listUsers({ page: 1, perPage: 100 });
    const emailById = new Map((usersData?.users || []).map((user) => [user.id, user.email || ""]));
    return json(200, (profiles || []).map((profile) => ({ ...profile, email: emailById.get(profile.user_id) || "" })), origin);
  }

  if (action === "invite") {
    const email = normalizeText(input.email).toLowerCase();
    const displayName = normalizeText(input.displayName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "올바른 이메일을 입력해주세요." }, origin);
    if (displayName.length < 1 || displayName.length > 40) return json(400, { error: "Admin 이름은 1~40자로 입력해주세요." }, origin);

    const { count, error: countError } = await service
      .from("admin_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("active", true);
    if (countError) return json(503, { error: "Admin 수를 확인하지 못했습니다." }, origin);
    if ((count || 0) >= 5) return json(409, { error: "활성 Admin은 최대 5명입니다." }, origin);

    const redirectTo = Deno.env.get("ADMIN_REDIRECT_URL") || `${DEFAULT_ORIGINS[0]}/retreat-prayer/admin/`;
    const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { retreat_prayer_needs_password_setup: true },
    });
    if (inviteError || !inviteData.user) return json(400, { error: inviteError?.message || "Admin 초대를 보내지 못했습니다." }, origin);

    const { data: profile, error: profileError } = await service
      .from("admin_profiles")
      .insert({ user_id: inviteData.user.id, display_name: displayName, role: "admin", active: true })
      .select("user_id, display_name, role, active, created_at")
      .single();
    if (profileError) {
      await service.auth.admin.deleteUser(inviteData.user.id).catch(() => undefined);
      return json(409, { error: profileError.message || "Admin 프로필을 만들지 못했습니다." }, origin);
    }

    const { error: auditError } = await service.from("admin_audit").insert({
      admin_id: authData.user.id,
      action: "admin.invite",
      target_type: "admin_profile",
      target_id: inviteData.user.id,
      details: { display_name: displayName },
    });
    if (auditError) {
      await service.from("admin_profiles").delete().eq("user_id", inviteData.user.id);
      await service.auth.admin.deleteUser(inviteData.user.id).catch(() => undefined);
      return json(503, { error: "작업 이력을 남기지 못해 Admin 초대를 취소했습니다." }, origin);
    }
    return json(201, { ...profile, email }, origin);
  }

  if (action === "disable") {
    const userId = normalizeText(input.userId);
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(400, { error: "Admin 계정을 확인할 수 없습니다." }, origin);
    if (userId === authData.user.id) return json(409, { error: "현재 로그인한 대표 관리자는 비활성화할 수 없습니다." }, origin);

    const { data: target, error: targetError } = await service
      .from("admin_profiles")
      .select("user_id, display_name, role, active")
      .eq("user_id", userId)
      .single();
    if (targetError || !target) return json(404, { error: "Admin 계정을 찾을 수 없습니다." }, origin);
    if (target.role === "owner") return json(409, { error: "대표 관리자는 먼저 권한을 이관해야 합니다." }, origin);

    const { data: profile, error } = await service
      .from("admin_profiles")
      .update({ active: false })
      .eq("user_id", userId)
      .select("user_id, display_name, role, active")
      .single();
    if (error) return json(409, { error: error.message || "Admin 계정을 비활성화하지 못했습니다." }, origin);

    const { error: auditError } = await service.from("admin_audit").insert({
      admin_id: authData.user.id,
      action: "admin.disable",
      target_type: "admin_profile",
      target_id: userId,
      details: { display_name: target.display_name },
    });
    if (auditError) {
      await service.from("admin_profiles").update({ active: true }).eq("user_id", userId);
      return json(503, { error: "작업 이력을 남기지 못해 계정 비활성화를 취소했습니다." }, origin);
    }
    return json(200, profile, origin);
  }

  if (action === "activate") {
    const userId = normalizeText(input.userId);
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(400, { error: "Admin 계정을 확인할 수 없습니다." }, origin);
    const { count, error: countError } = await service
      .from("admin_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("active", true);
    if (countError) return json(503, { error: "Admin 수를 확인하지 못했습니다." }, origin);
    if ((count || 0) >= 5) return json(409, { error: "활성 Admin은 최대 5명입니다." }, origin);

    const { data: profile, error } = await service
      .from("admin_profiles")
      .update({ active: true })
      .eq("user_id", userId)
      .select("user_id, display_name, role, active")
      .single();
    if (error) return json(409, { error: error.message || "Admin 계정을 활성화하지 못했습니다." }, origin);
    const { error: auditError } = await service.from("admin_audit").insert({
      admin_id: authData.user.id,
      action: "admin.activate",
      target_type: "admin_profile",
      target_id: userId,
      details: { display_name: profile.display_name },
    });
    if (auditError) {
      await service.from("admin_profiles").update({ active: false }).eq("user_id", userId);
      return json(503, { error: "작업 이력을 남기지 못해 계정 활성화를 취소했습니다." }, origin);
    }
    return json(200, profile, origin);
  }

  return json(400, { error: "지원하지 않는 Admin 작업입니다." }, origin);
});
