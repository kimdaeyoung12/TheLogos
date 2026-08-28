-- A running prayer session keeps its stage structure and timer authoritative,
-- but Admins may correct the title, scripture/topic copy, and assigned media.
-- This removes the need to stop a live gathering for a content-only edit.

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
  target_id uuid;
  program public.prayer_programs%rowtype;
  live public.live_sessions%rowtype;
  step jsonb;
  duration_seconds integer;
  step_media_id uuid;
  sanitized_steps jsonb := '[]'::jsonb;
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
  target_id := coalesce(p_program_id, live.program_id, extensions.gen_random_uuid());

  if live.status in ('live', 'paused') then
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
         or (incoming.value->>'duration_seconds')::integer
              is distinct from (existing.value->>'duration_seconds')::integer
    ) into running_structure_changed;

    if running_structure_changed then
      raise exception '진행 중에는 단계 순서, 종류, 시간을 바꿀 수 없습니다. 내용과 음악만 수정해주세요.';
    end if;
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

  if live.status in ('live', 'paused') then
    update public.live_sessions
    set program_snapshot = jsonb_build_object(
          'title', trim(p_title),
          'steps', sanitized_steps,
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
      jsonb_build_object('title', program.title, 'stage_index', live.stage_index)
    );

    return jsonb_build_object(
      'program', to_jsonb(program),
      'live_session', to_jsonb(live),
      'applied_to_running_session', true
    );
  end if;

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

revoke all on function public.configure_prayer_program(uuid, text, timestamptz, public.live_mode, jsonb) from public;
grant execute on function public.configure_prayer_program(uuid, text, timestamptz, public.live_mode, jsonb) to authenticated;
