-- Deployment-time assertions for the hosted retreat-prayer database. The DO
-- block leaves no application data behind; a failed assertion aborts deploy.
do $$
declare
  missing_rls text[];
  public_insert boolean;
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

  if not exists (
    select 1 from pg_trigger
    where tgname = 'admin_profiles_safety' and not tgisinternal
  ) then
    raise exception 'admin safety trigger is missing';
  end if;

  if has_function_privilege('anon', 'public.consume_submission_quota(text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.consume_submission_quota(text,text)', 'EXECUTE') then
    raise exception 'rate limit function must remain service-role only';
  end if;

  if to_regclass('realtime.messages') is null then
    raise exception 'realtime.messages is unavailable';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname in ('retreat_prayer_presence_read', 'retreat_prayer_presence_write')
    group by schemaname, tablename
    having count(*) = 2
  ) then
    raise exception 'private Presence policies are incomplete';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'retreat_prayer_postgres_changes_read'
  ) then
    raise exception 'private Postgres Changes policy is incomplete';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'prayer-audio' and public is true
  ) then
    raise exception 'retreat prayer audio bucket is missing';
  end if;

  if not exists (
    select 1 from cron.job
    where jobname = 'retreat-prayer-purge-expired'
      and active is true
  ) then
    raise exception 'retreat prayer purge cron is missing';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_sessions'
  ) or not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'content_revisions'
  ) then
    raise exception 'Realtime publication is incomplete';
  end if;
end
$$;
