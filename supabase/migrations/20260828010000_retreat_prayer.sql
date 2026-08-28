-- Retreat Prayer Platform
-- Public users see published content and approved requests only. All anonymous
-- writes pass through Edge Functions. Admin authority is table-owned and never
-- inferred from user-editable metadata.

create extension if not exists pgcrypto with schema extensions;

create type public.admin_role as enum ('owner', 'admin');
create type public.program_status as enum ('draft', 'published', 'archived');
create type public.live_status as enum ('draft', 'scheduled', 'live', 'paused', 'completed');
create type public.live_mode as enum ('manual', 'auto');
create type public.prayer_request_status as enum ('pending', 'approved', 'hidden', 'rejected', 'deleted');
create type public.media_kind as enum ('youtube', 'audio');

create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  app_name text not null default '수련회를 위한 공동기도',
  church_name text not null default '우리 공동체',
  retreat_date date,
  time_zone text not null default 'Asia/Seoul',
  daily_prayer_time time not null default '21:00',
  emergency_notice text not null default '' check (char_length(emergency_notice) <= 240),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);

-- Public clients subscribe only to this opaque counter. The event never carries
-- a pending prayer body; clients must re-read RLS-filtered public content.
create table public.content_revisions (
  id smallint primary key default 1 check (id = 1),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.content_revisions (id, revision) values (1, 1);

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role public.admin_role not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.daily_prayers (
  id uuid primary key default gen_random_uuid(),
  prayer_date date not null unique,
  scripture_reference text not null check (char_length(scripture_reference) between 1 and 80),
  scripture_text text not null check (char_length(scripture_text) between 1 and 1200),
  prayer_topic text not null check (char_length(prayer_topic) between 1 and 1200),
  published boolean not null default false,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.prayer_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  scheduled_for timestamptz,
  mode public.live_mode not null default 'manual',
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  status public.program_status not null default 'draft',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.live_sessions (
  id smallint primary key default 1 check (id = 1),
  status public.live_status not null default 'draft',
  mode public.live_mode not null default 'manual',
  scheduled_for timestamptz,
  program_id uuid references public.prayer_programs(id),
  program_snapshot jsonb not null default '{"title":"","steps":[]}'::jsonb,
  stage_index integer not null default 0 check (stage_index >= 0),
  started_at timestamptz,
  stage_started_at timestamptz,
  paused_at timestamptz,
  accumulated_pause_seconds integer not null default 0 check (accumulated_pause_seconds >= 0),
  paused_remaining_seconds integer check (paused_remaining_seconds is null or paused_remaining_seconds >= 0),
  announcement text not null default '' check (char_length(announcement) <= 240),
  media jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);

create table public.live_controller_leases (
  id smallint primary key default 1 check (id = 1),
  controller_id uuid references auth.users(id),
  lease_token uuid,
  expires_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 40),
  is_anonymous boolean not null default false,
  body text not null check (char_length(body) between 10 and 800),
  public_consent boolean not null check (public_consent),
  status public.prayer_request_status not null default 'pending',
  submitted_session_hash text not null,
  submitted_ip_hash text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  expires_at timestamptz not null default (clock_timestamp() + interval '180 days'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  label text not null check (char_length(label) between 1 and 80),
  source_url text,
  storage_path text,
  start_seconds integer not null default 0 check (start_seconds between 0 and 36000),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  check ((kind = 'youtube' and source_url is not null) or (kind = 'audio' and storage_path is not null))
);

create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id),
  action text not null check (char_length(action) between 1 and 80),
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create table public.submission_rate_limits (
  bucket text not null,
  key_hash text not null,
  request_count integer not null default 0,
  resets_at timestamptz not null,
  primary key (bucket, key_hash)
);

create index submission_rate_limits_resets_idx on public.submission_rate_limits (resets_at);

create index prayer_requests_public_idx on public.prayer_requests (status, approved_at desc) where status = 'approved';
create index prayer_requests_pending_idx on public.prayer_requests (created_at) where status = 'pending';
create index prayer_programs_schedule_idx on public.prayer_programs (scheduled_for) where status in ('draft', 'published');
create index admin_audit_created_idx on public.admin_audit (created_at desc);

create or replace function public.is_active_admin(required_role public.admin_role default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.active
      and (required_role is null or profile.role = required_role)
  );
$$;

revoke all on function public.is_active_admin(public.admin_role) from public;
grant execute on function public.is_active_admin(public.admin_role) to authenticated;

create or replace function public.server_now()
returns timestamptz
language sql
volatile
set search_path = pg_catalog
as $$ select clock_timestamp(); $$;

revoke all on function public.server_now() from public;
grant execute on function public.server_now() to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
create trigger admin_profiles_touch before update on public.admin_profiles for each row execute function public.touch_updated_at();
create trigger daily_prayers_touch before update on public.daily_prayers for each row execute function public.touch_updated_at();
create trigger prayer_programs_touch before update on public.prayer_programs for each row execute function public.touch_updated_at();
create trigger prayer_requests_touch before update on public.prayer_requests for each row execute function public.touch_updated_at();

create or replace function public.audit_prayer_request_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if old.status is distinct from new.status and public.is_active_admin() then
    if new.status = 'approved' then
      new.approved_by := caller;
      new.approved_at := coalesce(new.approved_at, clock_timestamp());
    end if;
    insert into public.admin_audit (admin_id, action, target_type, target_id, details)
    values (
      caller,
      'prayer_request.' || new.status::text,
      'prayer_request',
      new.id::text,
      jsonb_build_object('previous_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger prayer_requests_moderation_audit
before update of status on public.prayer_requests
for each row execute function public.audit_prayer_request_moderation();

create or replace function public.audit_admin_content_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is not null and public.is_active_admin() then
    insert into public.admin_audit (admin_id, action, target_type, target_id, details)
    values (
      caller,
      case
        when tg_table_name = 'daily_prayers' then 'daily_prayer.publish'
        when tg_table_name = 'app_settings' then 'settings.update'
        else 'media.save'
      end,
      tg_table_name,
      new.id::text,
      jsonb_build_object('operation', tg_op)
    );
  end if;
  return new;
end;
$$;

create trigger daily_prayers_content_audit
after insert or update on public.daily_prayers
for each row execute function public.audit_admin_content_change();

create trigger media_assets_content_audit
after insert or update on public.media_assets
for each row execute function public.audit_admin_content_change();

create trigger app_settings_content_audit
after update on public.app_settings
for each row execute function public.audit_admin_content_change();

create or replace function public.bump_public_content_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  publish_change boolean := false;
begin
  if tg_table_name = 'app_settings' then
    publish_change := true;
  elsif tg_table_name = 'daily_prayers' then
    case tg_op
      when 'INSERT' then publish_change := new.published;
      when 'UPDATE' then publish_change := old.published or new.published;
      when 'DELETE' then publish_change := old.published;
    end case;
  elsif tg_table_name = 'prayer_requests' then
    case tg_op
      when 'INSERT' then publish_change := new.status = 'approved';
      when 'UPDATE' then publish_change := old.status = 'approved' or new.status = 'approved';
      when 'DELETE' then publish_change := old.status = 'approved';
    end case;
  end if;

  if publish_change then
    update public.content_revisions
    set revision = revision + 1,
        updated_at = clock_timestamp()
    where id = 1;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger app_settings_public_revision
after update on public.app_settings
for each row execute function public.bump_public_content_revision();

create trigger daily_prayers_public_revision
after insert or update or delete on public.daily_prayers
for each row execute function public.bump_public_content_revision();

create trigger prayer_requests_public_revision
after insert or update or delete on public.prayer_requests
for each row execute function public.bump_public_content_revision();

create or replace function public.enforce_admin_safety()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_count integer;
  owner_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('retreat-prayer-admin-limit', 0));

  if tg_op in ('INSERT', 'UPDATE') and new.active then
    select count(*) into active_count
    from public.admin_profiles
    where active and user_id <> new.user_id;
    if active_count >= 5 then
      raise exception 'active admin limit is 5' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and old.active
     and (not new.active or new.role <> 'owner') then
    select count(*) into owner_count
    from public.admin_profiles
    where role = 'owner' and active and user_id <> old.user_id;
    if owner_count = 0 then
      raise exception 'the last active owner cannot be changed' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' and old.active then
    select count(*) into owner_count
    from public.admin_profiles
    where role = 'owner' and active and user_id <> old.user_id;
    if owner_count = 0 then
      raise exception 'the last active owner cannot be deleted' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger admin_profiles_safety
before insert or update or delete on public.admin_profiles
for each row execute function public.enforce_admin_safety();

create or replace function public.claim_live_controller(p_lease_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  lease public.live_controller_leases%rowtype;
  holder_name text;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;

  if p_lease_token is null then
    raise exception 'a live control lease token is required' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.live_controller_leases (id) values (1) on conflict (id) do nothing;
  select * into lease from public.live_controller_leases where id = 1 for update;

  if lease.controller_id is null or lease.expires_at is null or lease.expires_at <= clock_timestamp()
     or (lease.controller_id = caller and lease.lease_token is not distinct from p_lease_token) then
    update public.live_controller_leases
    set controller_id = caller,
        lease_token = p_lease_token,
        expires_at = clock_timestamp() + interval '30 seconds',
        updated_at = clock_timestamp()
    where id = 1
    returning * into lease;
    return jsonb_build_object(
      'acquired', true,
      'lease_token', lease.lease_token,
      'expires_at', lease.expires_at
    );
  end if;

  select display_name into holder_name from public.admin_profiles where user_id = lease.controller_id;
  return jsonb_build_object(
    'acquired', false,
    'controller_name', coalesce(holder_name, '다른 Admin'),
    'expires_at', lease.expires_at,
    'message', '다른 Admin이 현재 기도회를 제어하고 있습니다.'
  );
end;
$$;

revoke all on function public.claim_live_controller(uuid) from public;
grant execute on function public.claim_live_controller(uuid) to authenticated;

create or replace function public.apply_live_action(
  p_lease_token uuid,
  p_expected_version bigint,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  lease public.live_controller_leases%rowtype;
  current_state public.live_sessions%rowtype;
  steps_count integer;
  current_duration integer;
  elapsed_seconds integer;
  extension_seconds integer;
  effective_elapsed integer;
  cumulative_before integer := 0;
  action_time timestamptz := clock_timestamp();
  selected_media public.media_assets%rowtype;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;

  if p_lease_token is null then
    raise exception 'a live control lease token is required' using errcode = 'invalid_parameter_value';
  end if;

  select * into lease from public.live_controller_leases where id = 1 for update;
  if not found
     or lease.controller_id is distinct from caller
     or lease.lease_token is distinct from p_lease_token
     or lease.expires_at is null
     or lease.expires_at <= clock_timestamp() then
    raise exception 'live control lease is missing or expired' using errcode = 'serialization_failure';
  end if;

  select * into current_state from public.live_sessions where id = 1 for update;
  if not found then
    raise exception 'live session state is missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_expected_version is null then
    raise exception 'an expected live state version is required' using errcode = 'invalid_parameter_value';
  end if;
  if current_state.version is distinct from p_expected_version then
    raise exception 'live state changed; refresh before retrying' using errcode = 'serialization_failure';
  end if;

  steps_count := jsonb_array_length(coalesce(current_state.program_snapshot->'steps', '[]'::jsonb));

  -- Auto mode is derived from server time. Before an Admin action, materialize
  -- the current derived stage so pause/extend/NEXT operate on what participants
  -- are actually seeing rather than a stale stage_index.
  if current_state.mode = 'auto'
     and current_state.status = 'live'
     and current_state.started_at is not null
     and steps_count > 0 then
    effective_elapsed := greatest(
      0,
      extract(epoch from (action_time - current_state.started_at))::integer
        - current_state.accumulated_pause_seconds
    );
    cumulative_before := 0;
    for step_index in 0..steps_count - 1 loop
      current_duration := coalesce(
        (current_state.program_snapshot #>> array['steps', step_index::text, 'duration_seconds'])::integer,
        0
      );
      current_state.stage_index := step_index;
      exit when effective_elapsed < cumulative_before + current_duration or step_index = steps_count - 1;
      cumulative_before := cumulative_before + current_duration;
    end loop;
    elapsed_seconds := greatest(0, least(current_duration, effective_elapsed - cumulative_before));
    current_state.stage_started_at := action_time - make_interval(secs => elapsed_seconds);
  end if;

  case p_action
    when 'start' then
      if steps_count = 0 then raise exception 'program snapshot has no steps'; end if;
      if current_state.status in ('live', 'paused') then raise exception 'session is already running'; end if;
      current_state.status := 'live';
      current_state.stage_index := 0;
      current_state.started_at := action_time;
      current_state.stage_started_at := action_time;
      current_state.paused_at := null;
      current_state.paused_remaining_seconds := null;
      current_state.accumulated_pause_seconds := 0;
    when 'pause' then
      if current_state.status <> 'live' then raise exception 'only a live session can be paused'; end if;
      current_duration := coalesce((current_state.program_snapshot #>> array['steps', current_state.stage_index::text, 'duration_seconds'])::integer, 0);
      elapsed_seconds := greatest(0, extract(epoch from (action_time - coalesce(current_state.stage_started_at, action_time)))::integer);
      current_state.paused_remaining_seconds := greatest(0, current_duration - elapsed_seconds);
      current_state.paused_at := action_time;
      current_state.status := 'paused';
    when 'resume' then
      if current_state.status <> 'paused' then raise exception 'only a paused session can be resumed'; end if;
      current_duration := coalesce((current_state.program_snapshot #>> array['steps', current_state.stage_index::text, 'duration_seconds'])::integer, 0);
      elapsed_seconds := greatest(0, current_duration - coalesce(current_state.paused_remaining_seconds, current_duration));
      current_state.accumulated_pause_seconds := current_state.accumulated_pause_seconds
        + greatest(0, extract(epoch from (action_time - coalesce(current_state.paused_at, action_time)))::integer);
      current_state.stage_started_at := action_time - make_interval(secs => elapsed_seconds);
      current_state.paused_at := null;
      current_state.paused_remaining_seconds := null;
      current_state.status := 'live';
    when 'next' then
      if current_state.status not in ('live', 'paused') then raise exception 'session is not running'; end if;
      if current_state.stage_index >= greatest(steps_count - 1, 0) then
        raise exception 'already at the last stage';
      end if;
      current_state.stage_index := current_state.stage_index + 1;
      current_state.stage_started_at := action_time;
      current_state.media := null;
      if current_state.mode = 'auto' then
        cumulative_before := 0;
        if current_state.stage_index > 0 then
          for step_index in 0..current_state.stage_index - 1 loop
            cumulative_before := cumulative_before + coalesce(
              (current_state.program_snapshot #>> array['steps', step_index::text, 'duration_seconds'])::integer,
              0
            );
          end loop;
        end if;
        current_state.started_at := action_time - make_interval(
          secs => cumulative_before + current_state.accumulated_pause_seconds
        );
      end if;
      if current_state.status = 'paused' then
        current_state.paused_at := action_time;
        current_state.paused_remaining_seconds := coalesce(
          (current_state.program_snapshot #>> array['steps', current_state.stage_index::text, 'duration_seconds'])::integer,
          0
        );
      else
        current_state.paused_at := null;
        current_state.paused_remaining_seconds := null;
      end if;
    when 'previous' then
      if current_state.status not in ('live', 'paused') then raise exception 'session is not running'; end if;
      if current_state.stage_index <= 0 then raise exception 'already at the first stage'; end if;
      current_state.stage_index := current_state.stage_index - 1;
      current_state.stage_started_at := action_time;
      current_state.media := null;
      if current_state.mode = 'auto' then
        cumulative_before := 0;
        if current_state.stage_index > 0 then
          for step_index in 0..current_state.stage_index - 1 loop
            cumulative_before := cumulative_before + coalesce(
              (current_state.program_snapshot #>> array['steps', step_index::text, 'duration_seconds'])::integer,
              0
            );
          end loop;
        end if;
        current_state.started_at := action_time - make_interval(
          secs => cumulative_before + current_state.accumulated_pause_seconds
        );
      end if;
      if current_state.status = 'paused' then
        current_state.paused_at := action_time;
        current_state.paused_remaining_seconds := coalesce(
          (current_state.program_snapshot #>> array['steps', current_state.stage_index::text, 'duration_seconds'])::integer,
          0
        );
      else
        current_state.paused_at := null;
        current_state.paused_remaining_seconds := null;
      end if;
    when 'extend' then
      if current_state.status not in ('live', 'paused') then raise exception 'session is not running'; end if;
      extension_seconds := greatest(30, least(900, coalesce((p_payload->>'seconds')::integer, 60)));
      current_duration := coalesce((current_state.program_snapshot #>> array['steps', current_state.stage_index::text, 'duration_seconds'])::integer, 0);
      current_state.program_snapshot := jsonb_set(
        current_state.program_snapshot,
        array['steps', current_state.stage_index::text, 'duration_seconds'],
        to_jsonb(current_duration + extension_seconds),
        false
      );
      if current_state.status = 'paused' then
        current_state.paused_remaining_seconds := coalesce(current_state.paused_remaining_seconds, 0) + extension_seconds;
      end if;
    when 'announce' then
      current_state.announcement := left(coalesce(p_payload->>'message', ''), 240);
    when 'media_start' then
      if current_state.status not in ('live', 'paused') then raise exception 'session is not running'; end if;
      select * into selected_media
      from public.media_assets
      where id = nullif(current_state.program_snapshot #>> array['steps', current_state.stage_index::text, 'media_id'], '')::uuid
        and active;
      if not found then raise exception 'the current stage has no available media'; end if;
      current_state.media := jsonb_build_object(
        'id', selected_media.id,
        'kind', selected_media.kind,
        'label', selected_media.label,
        'source_url', selected_media.source_url,
        'start_seconds', selected_media.start_seconds,
        'active', selected_media.active,
        'stage_index', current_state.stage_index
      );
    when 'media_stop' then
      if current_state.status not in ('live', 'paused') then raise exception 'session is not running'; end if;
      current_state.media := jsonb_build_object('stopped', true, 'stage_index', current_state.stage_index);
    when 'complete' then
      current_state.status := 'completed';
      current_state.paused_at := null;
      current_state.paused_remaining_seconds := null;
    else
      raise exception 'unsupported live action';
  end case;

  current_state.version := current_state.version + 1;
  current_state.updated_at := action_time;

  update public.live_sessions set
    status = current_state.status,
    mode = current_state.mode,
    scheduled_for = current_state.scheduled_for,
    program_id = current_state.program_id,
    program_snapshot = current_state.program_snapshot,
    stage_index = current_state.stage_index,
    started_at = current_state.started_at,
    stage_started_at = current_state.stage_started_at,
    paused_at = current_state.paused_at,
    accumulated_pause_seconds = current_state.accumulated_pause_seconds,
    paused_remaining_seconds = current_state.paused_remaining_seconds,
    announcement = current_state.announcement,
    media = current_state.media,
    version = current_state.version,
    updated_at = current_state.updated_at
  where id = 1;

  insert into public.admin_audit (admin_id, action, target_type, target_id, details)
  values (caller, p_action, 'live_session', '1', p_payload);

  return to_jsonb(current_state);
end;
$$;

revoke all on function public.apply_live_action(uuid, bigint, text, jsonb) from public;
grant execute on function public.apply_live_action(uuid, bigint, text, jsonb) to authenticated;

create or replace function public.sync_automatic_live_session()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_state public.live_sessions%rowtype;
  total_seconds integer;
  elapsed_seconds integer;
begin
  select * into current_state from public.live_sessions where id = 1 for update;
  if not found then return null; end if;

  if current_state.mode = 'auto'
     and current_state.status = 'scheduled'
     and current_state.scheduled_for is not null
     and current_state.scheduled_for <= clock_timestamp() then
    update public.live_sessions
    set status = 'live',
        stage_index = 0,
        started_at = scheduled_for,
        stage_started_at = scheduled_for,
        paused_at = null,
        accumulated_pause_seconds = 0,
        paused_remaining_seconds = null,
        version = version + 1,
        updated_at = clock_timestamp()
    where id = 1
    returning * into current_state;
    insert into public.admin_audit (admin_id, action, target_type, target_id, details)
    values (null, 'system.auto_start', 'live_session', '1', '{}'::jsonb);
  end if;

  if current_state.mode = 'auto'
     and current_state.status = 'live'
     and current_state.started_at is not null then
    select coalesce(sum(greatest(0, (step->>'duration_seconds')::integer)), 0)
    into total_seconds
    from jsonb_array_elements(coalesce(current_state.program_snapshot->'steps', '[]'::jsonb)) step;
    elapsed_seconds := greatest(
      0,
      extract(epoch from (clock_timestamp() - current_state.started_at))::integer
        - current_state.accumulated_pause_seconds
    );
    if total_seconds > 0 and elapsed_seconds >= total_seconds then
      update public.live_sessions
      set status = 'completed',
          stage_index = greatest(jsonb_array_length(program_snapshot->'steps') - 1, 0),
          version = version + 1,
          updated_at = clock_timestamp()
      where id = 1
      returning * into current_state;
      insert into public.admin_audit (admin_id, action, target_type, target_id, details)
      values (null, 'system.auto_complete', 'live_session', '1', '{}'::jsonb);
    end if;
  end if;

  return to_jsonb(current_state);
end;
$$;

revoke all on function public.sync_automatic_live_session() from public;
grant execute on function public.sync_automatic_live_session() to anon, authenticated;

create or replace function public.configure_prayer_program(
  p_program_id uuid,
  p_title text,
  p_scheduled_for timestamptz,
  p_mode public.live_mode,
  p_steps jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  target_id uuid := coalesce(p_program_id, extensions.gen_random_uuid());
  program public.prayer_programs%rowtype;
  live public.live_sessions%rowtype;
  step jsonb;
  duration_seconds integer;
  step_media_id uuid;
  sanitized_steps jsonb := '[]'::jsonb;
  media_snapshot jsonb := '[]'::jsonb;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 120 then
    raise exception 'program title must be 1 to 120 characters';
  end if;
  if p_scheduled_for is null then raise exception 'scheduled time is required'; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) not between 1 and 12 then
    raise exception 'program must contain 1 to 12 steps';
  end if;

  for step in select value from jsonb_array_elements(p_steps) loop
    step_media_id := null;
    duration_seconds := coalesce((step->>'duration_seconds')::integer, 0);
    if char_length(trim(coalesce(step->>'label', ''))) not between 1 and 80
       or char_length(trim(coalesce(step->>'content', ''))) not between 1 and 1200
       or char_length(coalesce(step->>'scripture_reference', '')) > 80
       or coalesce(step->>'kind', 'prayer') not in ('scripture', 'prayer', 'request')
       or duration_seconds not between 60 and 3600 then
      raise exception 'each step requires a label, content, and duration between 60 and 3600 seconds';
    end if;
    if nullif(step->>'media_id', '') is not null then
      begin
        step_media_id := (step->>'media_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'step media id is invalid';
      end;
      if not exists (select 1 from public.media_assets where id = step_media_id and active) then
        raise exception 'step media is missing or inactive';
      end if;
    end if;
    sanitized_steps := sanitized_steps || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'id', coalesce(left(nullif(step->>'id', ''), 80), extensions.gen_random_uuid()::text),
        'label', trim(step->>'label'),
        'kind', coalesce(step->>'kind', 'prayer'),
        'scripture_reference', nullif(trim(coalesce(step->>'scripture_reference', '')), ''),
        'content', trim(step->>'content'),
        'duration_seconds', duration_seconds,
        'media_id', step_media_id
      ))
    );
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', asset.id,
        'kind', asset.kind,
        'label', asset.label,
        'source_url', asset.source_url,
        'start_seconds', asset.start_seconds,
        'active', asset.active
      ) order by asset.created_at
    ),
    '[]'::jsonb
  )
  into media_snapshot
  from public.media_assets asset
  where asset.active
    and asset.id in (
      select nullif(value->>'media_id', '')::uuid
      from jsonb_array_elements(sanitized_steps)
    );

  select * into live from public.live_sessions where id = 1 for update;
  if live.status in ('live', 'paused') then
    raise exception 'a running session cannot be reconfigured';
  end if;

  insert into public.prayer_programs (
    id, title, scheduled_for, mode, steps, status, created_by, updated_by
  ) values (
    target_id, trim(p_title), p_scheduled_for, p_mode, sanitized_steps, 'published', caller, caller
  )
  on conflict (id) do update set
    title = excluded.title,
    scheduled_for = excluded.scheduled_for,
    mode = excluded.mode,
    steps = excluded.steps,
    status = 'published',
    updated_by = caller
  returning * into program;

  update public.live_sessions
  set status = 'scheduled',
      mode = p_mode,
      scheduled_for = p_scheduled_for,
      program_id = target_id,
      program_snapshot = jsonb_build_object('title', trim(p_title), 'steps', sanitized_steps, 'media', media_snapshot),
      stage_index = 0,
      started_at = null,
      stage_started_at = null,
      paused_at = null,
      accumulated_pause_seconds = 0,
      paused_remaining_seconds = null,
      announcement = '',
      media = null,
      version = version + 1,
      updated_at = clock_timestamp()
  where id = 1
  returning * into live;

  insert into public.admin_audit (admin_id, action, target_type, target_id, details)
  values (
    caller,
    'program.publish',
    'prayer_program',
    target_id::text,
    jsonb_build_object('title', program.title, 'mode', program.mode, 'scheduled_for', program.scheduled_for)
  );

  return jsonb_build_object('program', to_jsonb(program), 'live_session', to_jsonb(live));
end;
$$;

revoke all on function public.configure_prayer_program(uuid, text, timestamptz, public.live_mode, jsonb) from public;
grant execute on function public.configure_prayer_program(uuid, text, timestamptz, public.live_mode, jsonb) to authenticated;

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

  return session_count <= 3 and ip_count <= 10;
end;
$$;

revoke all on function public.consume_submission_quota(text, text) from public, anon, authenticated;
grant execute on function public.consume_submission_quota(text, text) to service_role;

create or replace function public.purge_expired_prayer_requests()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
  rate_limit_count integer;
  anonymous_user_count integer;
begin
  delete from public.prayer_requests where expires_at <= clock_timestamp();
  get diagnostics deleted_count = row_count;
  delete from public.submission_rate_limits
  where resets_at <= clock_timestamp() - interval '24 hours';
  get diagnostics rate_limit_count = row_count;
  delete from auth.users
  where is_anonymous is true
    and created_at <= clock_timestamp() - interval '30 days';
  get diagnostics anonymous_user_count = row_count;
  return deleted_count + rate_limit_count + anonymous_user_count;
end;
$$;

revoke all on function public.purge_expired_prayer_requests() from public, anon, authenticated;
grant execute on function public.purge_expired_prayer_requests() to service_role;

alter table public.app_settings enable row level security;
alter table public.content_revisions enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.daily_prayers enable row level security;
alter table public.prayer_programs enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_controller_leases enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.media_assets enable row level security;
alter table public.admin_audit enable row level security;
alter table public.submission_rate_limits enable row level security;

revoke all on public.app_settings, public.content_revisions, public.admin_profiles, public.daily_prayers,
  public.prayer_programs, public.live_sessions, public.live_controller_leases,
  public.prayer_requests, public.media_assets, public.admin_audit,
  public.submission_rate_limits
from anon, authenticated;
grant select (id, app_name, church_name, retreat_date, time_zone, daily_prayer_time, emergency_notice, updated_at)
  on public.app_settings to anon, authenticated;
grant select (id, revision, updated_at) on public.content_revisions to anon, authenticated;
grant select (id, prayer_date, scripture_reference, scripture_text, prayer_topic, published, created_at, updated_at)
  on public.daily_prayers to anon, authenticated;
grant select (id, status, mode, scheduled_for, program_id, program_snapshot, stage_index, started_at,
  stage_started_at, paused_at, accumulated_pause_seconds, paused_remaining_seconds, announcement,
  media, version, updated_at)
  on public.live_sessions to anon, authenticated;
grant select (id, display_name, is_anonymous, body, status, approved_at, created_at)
  on public.prayer_requests to anon, authenticated;
grant select (id, kind, label, source_url, storage_path, start_seconds, active, created_at)
  on public.media_assets to anon, authenticated;
grant update (church_name, retreat_date, daily_prayer_time) on public.app_settings to authenticated;
grant insert, update on public.daily_prayers, public.media_assets to authenticated;
grant select on public.prayer_programs to authenticated;
grant update (status, approved_at) on public.prayer_requests to authenticated;
grant select on public.admin_profiles, public.admin_audit to authenticated;

create policy app_settings_public_read on public.app_settings for select to anon, authenticated using (true);
create policy app_settings_admin_update on public.app_settings for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy content_revisions_public_read on public.content_revisions for select to anon, authenticated using (true);

create policy daily_prayers_public_read on public.daily_prayers for select to anon, authenticated using (published);
create policy daily_prayers_admin_read on public.daily_prayers for select to authenticated using (public.is_active_admin());
create policy daily_prayers_admin_insert on public.daily_prayers for insert to authenticated with check (public.is_active_admin());
create policy daily_prayers_admin_update on public.daily_prayers for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy prayer_programs_admin_read on public.prayer_programs for select to authenticated using (public.is_active_admin());
create policy prayer_programs_admin_insert on public.prayer_programs for insert to authenticated with check (public.is_active_admin());
create policy prayer_programs_admin_update on public.prayer_programs for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy live_sessions_public_read on public.live_sessions for select to anon, authenticated using (true);

create policy prayer_requests_approved_read on public.prayer_requests for select to anon, authenticated
using (status = 'approved' and expires_at > clock_timestamp());
create policy prayer_requests_admin_read on public.prayer_requests for select to authenticated using (public.is_active_admin());
create policy prayer_requests_admin_update on public.prayer_requests for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy media_assets_public_read on public.media_assets for select to anon, authenticated using (active);
create policy media_assets_admin_read on public.media_assets for select to authenticated using (public.is_active_admin());
create policy media_assets_admin_insert on public.media_assets for insert to authenticated with check (public.is_active_admin());
create policy media_assets_admin_update on public.media_assets for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_profiles_self_or_owner_read on public.admin_profiles for select to authenticated
using (user_id = auth.uid() or public.is_active_admin('owner'));
create policy admin_audit_admin_read on public.admin_audit for select to authenticated using (public.is_active_admin());

-- Presence is private even though participants do not see a login screen. The
-- client uses Supabase Anonymous Auth, then tracks only an opaque session id.
create policy retreat_prayer_presence_read
on realtime.messages for select to authenticated
using (
  realtime.topic() in ('retreat-prayer:presence', 'retreat-prayer:presence:live')
  and realtime.messages.extension = 'presence'
);

create policy retreat_prayer_presence_write
on realtime.messages for insert to authenticated
with check (
  realtime.topic() in ('retreat-prayer:presence', 'retreat-prayer:presence:live')
  and realtime.messages.extension = 'presence'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prayer-audio', 'prayer-audio', true, 20971520, array['audio/mpeg', 'audio/mp4', 'audio/ogg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy prayer_audio_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'prayer-audio' and public.is_active_admin());
create policy prayer_audio_admin_update on storage.objects for update to authenticated
using (bucket_id = 'prayer-audio' and public.is_active_admin())
with check (bucket_id = 'prayer-audio' and public.is_active_admin());
create policy prayer_audio_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'prayer-audio' and public.is_active_admin());

insert into public.app_settings (id, app_name, church_name, retreat_date, time_zone, daily_prayer_time)
values (1, '수련회를 위한 공동기도', '우리 공동체', null, 'Asia/Seoul', time '21:00')
on conflict (id) do nothing;

insert into public.daily_prayers (
  prayer_date,
  scripture_reference,
  scripture_text,
  prayer_topic,
  published
)
values (
  (clock_timestamp() at time zone 'Asia/Seoul')::date,
  '빌립보서 4:6–7',
  '아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라.',
  '수련회를 준비하는 모든 손길에 지혜와 평안을 주시고, 참여하는 지체들의 마음을 말씀 앞에 부드럽게 열어주소서.',
  true
)
on conflict (prayer_date) do nothing;

insert into public.prayer_programs (id, title, scheduled_for, mode, steps, status)
values (
  '00000000-0000-4000-8000-000000000001',
  '저녁 공동기도',
  case
    when (clock_timestamp() at time zone 'Asia/Seoul')::time < time '21:00'
      then ((clock_timestamp() at time zone 'Asia/Seoul')::date + time '21:00') at time zone 'Asia/Seoul'
    else (((clock_timestamp() at time zone 'Asia/Seoul')::date + 1) + time '21:00') at time zone 'Asia/Seoul'
  end,
  'manual',
  '[
    {"id":"welcome","label":"마음을 모으는 시간","kind":"scripture","scripture_reference":"시편 133:1","content":"보라 형제가 연합하여 동거함이 어찌 그리 선하고 아름다운고","duration_seconds":180},
    {"id":"gratitude","label":"감사","kind":"prayer","scripture_reference":"데살로니가전서 5:18","content":"수련회를 준비하게 하신 은혜를 기억하며 감사로 기도합니다.","duration_seconds":240},
    {"id":"retreat","label":"수련회를 위한 기도","kind":"prayer","scripture_reference":"에베소서 3:17–19","content":"모든 지체가 그리스도의 사랑의 넓이와 길이와 높이와 깊이를 알아가도록 기도합니다.","duration_seconds":300},
    {"id":"community","label":"서로를 위한 중보","kind":"request","scripture_reference":"갈라디아서 6:2","content":"서로의 짐을 함께 지며, 나누어진 기도제목을 한마음으로 중보합니다.","duration_seconds":300},
    {"id":"closing","label":"공동체 기도","kind":"prayer","scripture_reference":"골로새서 3:14","content":"이 모든 것 위에 사랑을 더하여 공동체가 온전히 하나 되도록 기도합니다.","duration_seconds":180}
  ]'::jsonb,
  'published'
)
on conflict (id) do nothing;

insert into public.live_sessions (
  id,
  status,
  mode,
  scheduled_for,
  program_id,
  program_snapshot,
  stage_index
)
select
  1,
  'scheduled',
  program.mode,
  program.scheduled_for,
  program.id,
  jsonb_build_object('title', program.title, 'steps', program.steps),
  0
from public.prayer_programs program
where program.id = '00000000-0000-4000-8000-000000000001'
on conflict (id) do nothing;

insert into public.live_controller_leases (id) values (1) on conflict (id) do nothing;

alter publication supabase_realtime add table public.live_sessions, public.content_revisions;

-- Run shortly after midnight in Asia/Seoul (15:15 UTC) so expired prayer
-- requests and stale rate-limit hashes are removed without an external worker.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'retreat-prayer-purge-expired',
  '15 15 * * *',
  'select public.purge_expired_prayer_requests();'
);
