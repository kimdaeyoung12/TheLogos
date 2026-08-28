-- Only the active Live Controller may change content while a session is
-- running. Keep server-authoritative stage structure and extended durations,
-- and require optimistic version matching to prevent stale Admin consoles from
-- overwriting newer participant state.

revoke execute on function public.configure_prayer_program(
  uuid, text, timestamptz, public.live_mode, jsonb
) from authenticated;

create or replace function public.configure_prayer_program(
  p_program_id uuid,
  p_title text,
  p_scheduled_for timestamptz,
  p_mode public.live_mode,
  p_steps jsonb,
  p_lease_token uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  target_id uuid;
  program public.prayer_programs%rowtype;
  live public.live_sessions%rowtype;
  lease public.live_controller_leases%rowtype;
  step jsonb;
  duration_seconds integer;
  step_media_id uuid;
  sanitized_steps jsonb := '[]'::jsonb;
  live_merged_steps jsonb := '[]'::jsonb;
  program_merged_steps jsonb := '[]'::jsonb;
  media_snapshot jsonb := '[]'::jsonb;
  running_structure_changed boolean := false;
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
      if not exists (
        select 1 from public.media_assets
        where id = step_media_id and active and kind = 'audio'
      ) then
        raise exception '공동기도에는 직접 업로드한 활성 음원만 연결할 수 있습니다.';
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

  -- Match apply_live_action's lock order so configure/NEXT/extend cannot
  -- deadlock or interleave changes from different consoles.
  insert into public.live_controller_leases (id) values (1) on conflict (id) do nothing;
  select * into lease from public.live_controller_leases where id = 1 for update;
  select * into live from public.live_sessions where id = 1 for update;
  if not found then
    raise exception 'live session state is missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  target_id := coalesce(p_program_id, live.program_id, extensions.gen_random_uuid());

  if live.status in ('live', 'paused') then
    if p_lease_token is null
       or lease.controller_id is distinct from caller
       or lease.lease_token is distinct from p_lease_token
       or lease.expires_at is null
       or lease.expires_at <= clock_timestamp() then
      raise exception '현재 Live Control 제어권을 먼저 확보해주세요.' using errcode = 'serialization_failure';
    end if;
    if p_expected_version is null then
      raise exception 'an expected live state version is required' using errcode = 'invalid_parameter_value';
    end if;
    if live.version is distinct from p_expected_version then
      raise exception '기도회 상태가 변경되었습니다. 최신 상태를 확인한 뒤 다시 게시해주세요.' using errcode = 'serialization_failure';
    end if;
    if p_program_id is null or p_program_id is distinct from live.program_id then
      raise exception '진행 중인 기도회와 다른 구성은 게시할 수 없습니다.' using errcode = 'object_not_in_prerequisite_state';
    end if;

    select exists (
      select 1
      from jsonb_array_elements(sanitized_steps) with ordinality as incoming(value, position)
      full join jsonb_array_elements(coalesce(live.program_snapshot->'steps', '[]'::jsonb))
        with ordinality as existing(value, position)
        using (position)
      where incoming.value is null
         or existing.value is null
         or incoming.value->>'id' is distinct from existing.value->>'id'
         or incoming.value->>'kind' is distinct from existing.value->>'kind'
    ) into running_structure_changed;

    if running_structure_changed then
      raise exception '진행 중에는 단계 수, 순서, 종류를 바꿀 수 없습니다. 내용과 음악만 수정해주세요.';
    end if;

    -- Preserve IDs, kinds, and the live snapshot's duration (including an
    -- Admin extension); merge only content fields and the selected media.
    select coalesce(jsonb_agg(
      jsonb_strip_nulls(existing.value || jsonb_build_object(
        'label', incoming.value->'label',
        'scripture_reference', incoming.value->'scripture_reference',
        'content', incoming.value->'content',
        'media_id', incoming.value->'media_id'
      )) order by incoming.position
    ), '[]'::jsonb)
    into live_merged_steps
    from jsonb_array_elements(sanitized_steps) with ordinality as incoming(value, position)
    join jsonb_array_elements(coalesce(live.program_snapshot->'steps', '[]'::jsonb))
      with ordinality as existing(value, position)
      using (position);

    select * into program from public.prayer_programs where id = target_id for update;
    if found
       and jsonb_typeof(program.steps) = 'array'
       and jsonb_array_length(program.steps) = jsonb_array_length(sanitized_steps) then
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(existing.value || jsonb_build_object(
          'label', incoming.value->'label',
          'scripture_reference', incoming.value->'scripture_reference',
          'content', incoming.value->'content',
          'media_id', incoming.value->'media_id'
        )) order by incoming.position
      ), '[]'::jsonb)
      into program_merged_steps
      from jsonb_array_elements(sanitized_steps) with ordinality as incoming(value, position)
      join jsonb_array_elements(program.steps) with ordinality as existing(value, position)
        using (position);
    else
      program_merged_steps := sanitized_steps;
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', asset.id,
        'kind', asset.kind,
        'label', asset.label,
        'source_url', asset.source_url,
        'start_seconds', asset.start_seconds,
        'active', asset.active
      ) order by asset.created_at
    ), '[]'::jsonb)
    into media_snapshot
    from public.media_assets asset
    where asset.active
      and asset.id in (
        select nullif(value->>'media_id', '')::uuid
        from jsonb_array_elements(live_merged_steps)
      );

    update public.prayer_programs
    set title = trim(p_title),
        steps = program_merged_steps,
        status = 'published',
        updated_by = caller
    where id = target_id
    returning * into program;

    update public.live_sessions
    set program_snapshot = jsonb_build_object(
          'title', trim(p_title),
          'steps', live_merged_steps,
          'media', media_snapshot
        ),
        version = version + 1,
        updated_at = clock_timestamp()
    where id = 1
    returning * into live;

    insert into public.admin_audit (admin_id, action, target_type, target_id, details)
    values (
      caller,
      'program.update_live_content',
      'prayer_program',
      target_id::text,
      jsonb_build_object('title', program.title, 'stage_index', live.stage_index, 'version', live.version)
    );

    return jsonb_build_object(
      'program', to_jsonb(program),
      'live_session', to_jsonb(live),
      'applied_to_running_session', true
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', asset.id,
      'kind', asset.kind,
      'label', asset.label,
      'source_url', asset.source_url,
      'start_seconds', asset.start_seconds,
      'active', asset.active
    ) order by asset.created_at
  ), '[]'::jsonb)
  into media_snapshot
  from public.media_assets asset
  where asset.active
    and asset.id in (
      select nullif(value->>'media_id', '')::uuid
      from jsonb_array_elements(sanitized_steps)
    );

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

  return jsonb_build_object(
    'program', to_jsonb(program),
    'live_session', to_jsonb(live),
    'applied_to_running_session', false
  );
end;
$$;

revoke all on function public.configure_prayer_program(
  uuid, text, timestamptz, public.live_mode, jsonb, uuid, bigint
) from public;
grant execute on function public.configure_prayer_program(
  uuid, text, timestamptz, public.live_mode, jsonb, uuid, bigint
) to authenticated;
