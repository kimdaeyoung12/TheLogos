export function getSupabaseSecretKey(): string | null {
  const hostedKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (hostedKeys) {
    try {
      const keys = JSON.parse(hostedKeys) as Record<string, unknown>;
      if (typeof keys.default === "string" && keys.default) return keys.default;
    } catch {
      // Fall through to local-development compatibility values.
    }
  }

  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}
