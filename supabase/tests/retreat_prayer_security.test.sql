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
      'media_assets', 'admin_audit', 'submission_rate_limits', 'admin_invite_nonces'
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

  if has_table_privilege('anon', 'public.admin_invite_nonces', 'SELECT')
     or has_table_privilege('authenticated', 'public.admin_invite_nonces', 'SELECT') then
    raise exception 'Admin invite nonces must not be visible to browser roles';
  end if;

  if has_function_privilege('anon', 'public.hook_restrict_retreat_prayer_signup(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.hook_restrict_retreat_prayer_signup(jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.hook_restrict_retreat_prayer_signup(jsonb)', 'EXECUTE')
     or not has_function_privilege('supabase_auth_admin', 'public.hook_restrict_retreat_prayer_signup(jsonb)', 'EXECUTE') then
    raise exception 'Before User Created hook privileges are unsafe';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.configure_prayer_program(uuid,text,timestamp with time zone,public.live_mode,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.configure_prayer_program(uuid,text,timestamp with time zone,public.live_mode,jsonb,uuid,bigint)',
       'EXECUTE'
     ) then
    raise exception 'live program editing must require lease and expected version arguments';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'retreat_prayer_postgres_changes_read'
  ) then
    raise exception 'private Postgres Changes policy is incomplete';
  end if;
end
$$;
