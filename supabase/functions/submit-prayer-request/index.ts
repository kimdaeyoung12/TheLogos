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

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function containsSensitiveInformation(value: string): boolean {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /(?:\+?82[-\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/;
  const url = /(?:https?:\/\/|www\.)\S+/i;
  return [email, phone, url].some((pattern) => pattern.test(value));
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const origins = allowedOrigins();

  if (origin && !origins.has(origin)) {
    return json(403, { error: "허용되지 않은 요청 경로입니다." }, DEFAULT_ORIGINS[0]);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return json(405, { error: "POST 요청만 지원합니다." }, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getSupabaseSecretKey();
  const rateLimitSalt = Deno.env.get("PRAYER_RATE_LIMIT_SALT");
  if (!supabaseUrl || !serviceRoleKey || !rateLimitSalt) {
    return json(503, { error: "제출 기능이 아직 준비되지 않았습니다." }, origin);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(401, { error: "익명 세션을 확인할 수 없습니다." }, origin);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await service.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: "익명 세션이 만료되었습니다. 새로고침 후 다시 시도해주세요." }, origin);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json(400, { error: "제출 내용을 읽을 수 없습니다." }, origin);
  }

  const isAnonymous = input.isAnonymous === true;
  const displayName = isAnonymous ? "익명" : normalizeText(input.displayName);
  const body = normalizeText(input.body);
  const consent = input.consent === true;
  const sessionId = normalizeText(input.sessionId);

  if (!consent) return json(400, { error: "공개 동의가 필요합니다." }, origin);
  if (displayName.length < 1 || displayName.length > 40) {
    return json(400, { error: "이름 또는 닉네임은 1~40자로 입력해주세요." }, origin);
  }
  if (body.length < 10 || body.length > 800) {
    return json(400, { error: "기도제목은 10~800자로 입력해주세요." }, origin);
  }
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(sessionId)) {
    return json(400, { error: "브라우저 세션을 확인할 수 없습니다." }, origin);
  }
  if (containsSensitiveInformation(body)) {
    return json(400, {
      error: "연락처, 주소, 링크처럼 개인을 식별할 수 있는 내용은 제외해주세요.",
      code: "SENSITIVE_INFORMATION",
    }, origin);
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const sessionHash = await sha256(`${rateLimitSalt}:session:${authData.user.id}:${sessionId}`);
  const ipHash = forwardedFor ? await sha256(`${rateLimitSalt}:ip:${forwardedFor}`) : null;
  const { data: withinQuota, error: quotaError } = await service.rpc("consume_submission_quota", {
    p_session_hash: sessionHash,
    p_ip_hash: ipHash,
  });
  if (quotaError) return json(503, { error: "제출 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." }, origin);
  if (!withinQuota) {
    return json(429, { error: "짧은 시간에 여러 번 제출되었습니다. 잠시 후 다시 시도해주세요." }, origin);
  }

  const { data, error } = await service
    .from("prayer_requests")
    .insert({
      display_name: displayName,
      is_anonymous: isAnonymous,
      body,
      public_consent: true,
      status: "pending",
      submitted_session_hash: sessionHash,
      submitted_ip_hash: ipHash,
    })
    .select("id, status")
    .single();

  if (error) return json(503, { error: "기도제목을 전달하지 못했습니다. 잠시 후 다시 시도해주세요." }, origin);
  return json(201, data, origin);
});
