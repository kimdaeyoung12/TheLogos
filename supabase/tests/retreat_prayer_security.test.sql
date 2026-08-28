-- Run after applying migrations to a disposable Supabase database.
-- This is a catalog-level smoke test; destructive behavior and role-bound RLS
-- should also be exercised in Supabase's staging project before publication.

do $$
declare
  missing_rls text[];
  public_insert boolean;
  admin_limit_trigger boolean;
begin
  select array_agg(c.relname order by c.relname)
  into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'app_settings', 'content_revisions', 'admin_profiles', 'daily_prayers', 'prayer_programs',
      'live_sessions', 'live_controller_leases', 'prayer_requests',
      'media_assets', 'admin_audit', 'submission_rate_limits'
    ])
    and not c.relrowsecurity;

  if missing_rls is not null then
    raise exception 'RLS disabled on: %', array_to_string(missing_rls, ', ');
  end if;

  select has_table_privilege('anon', 'public.prayer_requests', 'INSERT')
      or has_table_privilege('authenticated', 'public.prayer_requests', 'INSERT')
  into public_insert;
  if public_insert then
    raise exception 'prayer_requests direct INSERT is exposed';
  end if;

  if has_column_privilege('anon', 'public.prayer_requests', 'submitted_session_hash', 'SELECT')
     or has_column_privilege('authenticated', 'public.prayer_requests', 'submitted_ip_hash', 'SELECT') then
    raise exception 'submission hashes must not be selectable by browser roles';
  end if;

  select exists (
    select 1
    from pg_trigger
    where tgname = 'admin_profiles_safety'
      and not tgisinternal
  ) into admin_limit_trigger;
  if not admin_limit_trigger then
    raise exception 'admin safety trigger is missing';
  end if;

  if has_function_privilege('anon', 'public.consume_submission_quota(text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.consume_submission_quota(text,text)', 'EXECUTE') then
    raise exception 'rate limit function must remain service-role only';
  end if;
end
$$;
