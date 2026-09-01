-- Persist Live Control until an explicit release or generation-checked takeover,
-- and give participant announcements a durable identity across reconnects.

alter table public.live_sessions
  add column if not exists announcement_id uuid,
  add column if not exists announcement_created_at timestamptz;

alter table public.live_controller_leases
  add column if not exists controller_generation bigint not null default 1
    check (controller_generation >= 1);

update public.live_controller_leases
set expires_at = '9999-12-31 23:59:59+00'::timestamptz,
    updated_at = clock_timestamp()
where controller_id is not null
  and lease_token is not null
  and expires_at > clock_timestamp();

-- Never resurrect a controller that had already expired under the previous
-- 90-second lease contract before this migration began.
update public.live_controller_leases
set controller_id = null,
    lease_token = null,
    expires_at = null,
    controller_generation = controller_generation + 1,
    updated_at = clock_timestamp()
where (controller_id is not null or lease_token is not null or expires_at is not null)
  and not (
    controller_id is not null
    and lease_token is not null
    and expires_at > clock_timestamp()
  );

create or replace function public.stamp_live_announcement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.announcement := left(btrim(coalesce(new.announcement, '')), 240);
  if new.announcement is distinct from old.announcement then
    if new.announcement = '' then
      if current_setting('retreat_prayer.allow_announcement_clear', true) = 'on' then
        new.announcement_id := null;
        new.announcement_created_at := null;
      else
        -- Legacy program configuration used to clear announcements as an
        -- unrelated side effect. Only the dedicated clear RPC may do that.
        new.announcement := old.announcement;
        new.announcement_id := old.announcement_id;
        new.announcement_created_at := old.announcement_created_at;
      end if;
    else
      new.announcement_id := gen_random_uuid();
      new.announcement_created_at := clock_timestamp();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists live_announcement_stamp on public.live_sessions;
create trigger live_announcement_stamp
before update of announcement on public.live_sessions
for each row execute function public.stamp_live_announcement();

update public.live_sessions
set announcement_id = gen_random_uuid(),
    announcement_created_at = coalesce(updated_at, clock_timestamp())
where btrim(coalesce(announcement, '')) <> ''
  and announcement_id is null;

-- Compatibility only: old clients may maintain the exact lease they already
-- hold, but can never acquire an empty controller slot after release.
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
    raise exception 'a live control token is required' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.live_controller_leases (id) values (1) on conflict (id) do nothing;
  select * into lease from public.live_controller_leases where id = 1 for update;

  if lease.controller_id = caller and lease.lease_token is not distinct from p_lease_token then
    update public.live_controller_leases
    set expires_at = '9999-12-31 23:59:59+00'::timestamptz,
        updated_at = clock_timestamp()
    where id = 1
    returning * into lease;
    return jsonb_build_object(
      'acquired', true,
      'persistent', true,
      'lease_token', lease.lease_token,
      'expires_at', lease.expires_at,
      'controller_id', lease.controller_id,
      'controller_generation', lease.controller_generation
    );
  end if;

  select display_name into holder_name from public.admin_profiles where user_id = lease.controller_id;
  return jsonb_build_object(
    'acquired', false,
    'available', lease.controller_id is null,
    'persistent', true,
    'controller_id', lease.controller_id,
    'controller_name', holder_name,
    'controller_generation', lease.controller_generation,
    'message', case
      when lease.controller_id is null then '현재 Live Control 제어권을 가진 Admin이 없습니다.'
      else coalesce(holder_name, '다른 Admin') || ' Admin이 현재 기도회를 제어하고 있습니다.'
    end
  );
end;
$$;

create or replace function public.acquire_live_controller(
  p_lease_token uuid,
  p_expected_generation bigint
)
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
  if p_lease_token is null or p_expected_generation is null then
    raise exception 'a token and expected controller generation are required' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.live_controller_leases (id) values (1) on conflict (id) do nothing;
  select * into lease from public.live_controller_leases where id = 1 for update;

  if lease.controller_generation is distinct from p_expected_generation then
    return jsonb_build_object(
      'acquired', false,
      'changed', true,
      'available', lease.controller_id is null,
      'controller_id', lease.controller_id,
      'controller_generation', lease.controller_generation,
      'message', '제어권 상태가 변경되었습니다. 최신 상태를 다시 확인해주세요.'
    );
  end if;

  if lease.controller_id is null then
    update public.live_controller_leases
    set controller_id = caller,
        lease_token = p_lease_token,
        expires_at = '9999-12-31 23:59:59+00'::timestamptz,
        controller_generation = controller_generation + 1,
        updated_at = clock_timestamp()
    where id = 1
    returning * into lease;

    insert into public.admin_audit (admin_id, action, target_type, target_id, details)
    values (caller, 'live_controller.acquire', 'live_controller', '1', jsonb_build_object('generation', lease.controller_generation));

    return jsonb_build_object(
      'acquired', true,
      'persistent', true,
      'lease_token', lease.lease_token,
      'expires_at', lease.expires_at,
      'controller_id', lease.controller_id,
      'controller_generation', lease.controller_generation
    );
  end if;

  if lease.controller_id = caller and lease.lease_token is not distinct from p_lease_token then
    return jsonb_build_object(
      'acquired', true,
      'persistent', true,
      'lease_token', lease.lease_token,
      'expires_at', lease.expires_at,
      'controller_id', lease.controller_id,
      'controller_generation', lease.controller_generation
    );
  end if;

  select display_name into holder_name from public.admin_profiles where user_id = lease.controller_id;
  return jsonb_build_object(
    'acquired', false,
    'available', false,
    'persistent', true,
    'controller_id', lease.controller_id,
    'controller_name', holder_name,
    'controller_generation', lease.controller_generation,
    'message', coalesce(holder_name, '다른 Admin') || ' Admin이 현재 기도회를 제어하고 있습니다.'
  );
end;
$$;

create or replace function public.get_live_controller_status(p_lease_token uuid)
returns jsonb
language plpgsql
stable
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

  select * into lease from public.live_controller_leases where id = 1;
  if not found then
    return jsonb_build_object('acquired', false, 'available', true, 'persistent', true, 'controller_generation', 1);
  end if;

  select display_name into holder_name from public.admin_profiles where user_id = lease.controller_id;
  return jsonb_build_object(
    'acquired', lease.controller_id = caller and lease.lease_token is not distinct from p_lease_token,
    'available', lease.controller_id is null,
    'persistent', true,
    'expires_at', lease.expires_at,
    'controller_id', lease.controller_id,
    'controller_name', holder_name,
    'controller_generation', lease.controller_generation,
    'message', case
      when lease.controller_id is null then '현재 Live Control 제어권을 가진 Admin이 없습니다.'
      when lease.controller_id = caller and lease.lease_token is not distinct from p_lease_token then '현재 Admin이 Live Control을 보유하고 있습니다.'
      else coalesce(holder_name, '다른 Admin') || ' Admin이 현재 기도회를 제어하고 있습니다.'
    end
  );
end;
$$;

create or replace function public.release_live_controller(
  p_lease_token uuid,
  p_expected_generation bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  lease public.live_controller_leases%rowtype;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;

  select * into lease from public.live_controller_leases where id = 1 for update;
  if not found
     or lease.controller_generation is distinct from p_expected_generation
     or lease.controller_id is distinct from caller
     or lease.lease_token is distinct from p_lease_token then
    return jsonb_build_object(
      'released', false,
      'changed', true,
      'controller_generation', lease.controller_generation,
      'message', '제어권 상태가 변경되어 반납하지 않았습니다.'
    );
  end if;

  update public.live_controller_leases
  set controller_id = null,
      lease_token = null,
      expires_at = null,
      controller_generation = controller_generation + 1,
      updated_at = clock_timestamp()
  where id = 1
  returning * into lease;

  insert into public.admin_audit (admin_id, action, target_type, target_id, details)
  values (caller, 'live_controller.release', 'live_controller', '1', jsonb_build_object('generation', lease.controller_generation));

  return jsonb_build_object('released', true, 'controller_generation', lease.controller_generation);
end;
$$;

create or replace function public.take_over_live_controller(
  p_lease_token uuid,
  p_expected_generation bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  lease public.live_controller_leases%rowtype;
  previous_controller uuid;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;
  if p_lease_token is null or p_expected_generation is null then
    raise exception 'a token and expected controller generation are required' using errcode = 'invalid_parameter_value';
  end if;

  select * into lease from public.live_controller_leases where id = 1 for update;
  if not found or lease.controller_generation is distinct from p_expected_generation or lease.controller_id is null then
    return jsonb_build_object(
      'acquired', false,
      'changed', true,
      'available', lease.controller_id is null,
      'controller_generation', lease.controller_generation,
      'message', '제어권 상태가 변경되어 승계하지 않았습니다.'
    );
  end if;

  previous_controller := lease.controller_id;
  update public.live_controller_leases
  set controller_id = caller,
      lease_token = p_lease_token,
      expires_at = '9999-12-31 23:59:59+00'::timestamptz,
      controller_generation = controller_generation + 1,
      updated_at = clock_timestamp()
  where id = 1
  returning * into lease;

  insert into public.admin_audit (admin_id, action, target_type, target_id, details)
  values (
    caller,
    'live_controller.takeover',
    'live_controller',
    '1',
    jsonb_build_object('previous_controller_id', previous_controller, 'generation', lease.controller_generation)
  );

  return jsonb_build_object(
    'acquired', true,
    'persistent', true,
    'lease_token', lease.lease_token,
    'expires_at', lease.expires_at,
    'controller_id', lease.controller_id,
    'controller_generation', lease.controller_generation
  );
end;
$$;

create or replace function public.publish_live_announcement(
  p_lease_token uuid,
  p_expected_version bigint,
  p_message text
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
  normalized_message text := left(btrim(coalesce(p_message, '')), 240);
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;

  select * into lease from public.live_controller_leases where id = 1 for update;
  if not found
     or lease.controller_id is distinct from caller
     or lease.lease_token is distinct from p_lease_token
     or lease.expires_at is null
     or lease.expires_at <= clock_timestamp() then
    raise exception 'live control permission is missing' using errcode = 'serialization_failure';
  end if;

  select * into current_state from public.live_sessions where id = 1 for update;
  if not found then
    raise exception 'live session state is missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_expected_version is null or current_state.version is distinct from p_expected_version then
    raise exception 'live state changed; refresh before retrying' using errcode = 'serialization_failure';
  end if;

  if normalized_message = '' then
    perform set_config('retreat_prayer.allow_announcement_clear', 'on', true);
  end if;

  update public.live_sessions
  set announcement = normalized_message,
      announcement_id = case when normalized_message = '' then null else gen_random_uuid() end,
      announcement_created_at = case when normalized_message = '' then null else clock_timestamp() end,
      version = version + 1,
      updated_at = clock_timestamp()
  where id = 1
  returning * into current_state;

  insert into public.admin_audit (admin_id, action, target_type, target_id, details)
  values (
    caller,
    case when normalized_message = '' then 'announcement.clear' else 'announcement.publish' end,
    'live_session',
    '1',
    jsonb_build_object(
      'announcement_id', current_state.announcement_id,
      'character_count', char_length(normalized_message)
    )
  );

  return to_jsonb(current_state);
end;
$$;

revoke all on function public.claim_live_controller(uuid) from public;
revoke all on function public.acquire_live_controller(uuid, bigint) from public;
revoke all on function public.get_live_controller_status(uuid) from public;
revoke all on function public.release_live_controller(uuid, bigint) from public;
revoke all on function public.take_over_live_controller(uuid, bigint) from public;
revoke all on function public.publish_live_announcement(uuid, bigint, text) from public;

grant execute on function public.claim_live_controller(uuid) to authenticated;
grant execute on function public.acquire_live_controller(uuid, bigint) to authenticated;
grant execute on function public.get_live_controller_status(uuid) to authenticated;
grant execute on function public.release_live_controller(uuid, bigint) to authenticated;
grant execute on function public.take_over_live_controller(uuid, bigint) to authenticated;
grant execute on function public.publish_live_announcement(uuid, bigint, text) to authenticated;

grant select (announcement_id, announcement_created_at) on public.live_sessions to anon, authenticated;
