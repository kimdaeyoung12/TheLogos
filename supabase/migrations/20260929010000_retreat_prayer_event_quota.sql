-- Support up to 50 retreat participants sharing a single Wi-Fi public IP.
-- Keep the existing per-session quota and atomic UPSERTs; rejected attempts still count.
create or replace function public.consume_submission_quota(
  p_session_hash text,
  p_ip_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_count integer;
  ip_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('prayer-rate:' || p_session_hash, 0));

  insert into public.submission_rate_limits (bucket, key_hash, request_count, resets_at)
  values ('session-10m', p_session_hash, 1, clock_timestamp() + interval '10 minutes')
  on conflict (bucket, key_hash) do update
  set request_count = case when public.submission_rate_limits.resets_at <= clock_timestamp() then 1 else public.submission_rate_limits.request_count + 1 end,
      resets_at = case when public.submission_rate_limits.resets_at <= clock_timestamp() then clock_timestamp() + interval '10 minutes' else public.submission_rate_limits.resets_at end
  returning request_count into session_count;

  if p_ip_hash is not null then
    insert into public.submission_rate_limits (bucket, key_hash, request_count, resets_at)
    values ('ip-1h', p_ip_hash, 1, clock_timestamp() + interval '1 hour')
    on conflict (bucket, key_hash) do update
    set request_count = case when public.submission_rate_limits.resets_at <= clock_timestamp() then 1 else public.submission_rate_limits.request_count + 1 end,
        resets_at = case when public.submission_rate_limits.resets_at <= clock_timestamp() then clock_timestamp() + interval '1 hour' else public.submission_rate_limits.resets_at end
    returning request_count into ip_count;
  else
    ip_count := 0;
  end if;

  return session_count <= 3 and ip_count <= 150;
end;
$$;

revoke all on function public.consume_submission_quota(text, text) from public, anon, authenticated;
grant execute on function public.consume_submission_quota(text, text) to service_role;
