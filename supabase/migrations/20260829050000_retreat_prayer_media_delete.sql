create or replace function public.delete_media_asset(p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  current_status text;
  target public.media_assets%rowtype;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;

  select status::text into current_status
  from public.live_sessions
  where id = 1;

  if current_status in ('live', 'paused') then
    raise exception '진행 중인 기도회를 종료한 뒤 음악을 삭제할 수 있습니다.';
  end if;

  select * into target
  from public.media_assets
  where id = p_media_id
  for update;

  if not found then
    raise exception '삭제할 음악을 찾을 수 없습니다.';
  end if;

  update public.prayer_programs as program
  set steps = (
        select coalesce(jsonb_agg(
          case
            when step.value->>'media_id' = p_media_id::text then step.value - 'media_id'
            else step.value
          end
          order by step.ordinality
        ), '[]'::jsonb)
        from jsonb_array_elements(program.steps) with ordinality as step(value, ordinality)
      ),
      updated_by = caller
  where exists (
    select 1
    from jsonb_array_elements(program.steps) as linked_step
    where linked_step->>'media_id' = p_media_id::text
  );

  update public.live_sessions as live
  set program_snapshot = jsonb_set(
        live.program_snapshot,
        '{steps}',
        (
          select coalesce(jsonb_agg(
            case
              when step.value->>'media_id' = p_media_id::text then step.value - 'media_id'
              else step.value
            end
            order by step.ordinality
          ), '[]'::jsonb)
          from jsonb_array_elements(coalesce(live.program_snapshot->'steps', '[]'::jsonb))
            with ordinality as step(value, ordinality)
        ),
        true
      ),
      media = case when live.media->>'id' = p_media_id::text then null else live.media end,
      version = live.version + 1,
      updated_at = clock_timestamp()
  where live.id = 1
    and (
      live.media->>'id' = p_media_id::text
      or exists (
        select 1
        from jsonb_array_elements(coalesce(live.program_snapshot->'steps', '[]'::jsonb)) as linked_step
        where linked_step->>'media_id' = p_media_id::text
      )
    );

  delete from public.media_assets where id = p_media_id;

  insert into public.admin_audit (admin_id, action, target_type, target_id, details)
  values (
    caller,
    'media.delete',
    'media_assets',
    target.id::text,
    jsonb_build_object('label', target.label, 'kind', target.kind, 'storage_path', target.storage_path)
  );

  return jsonb_build_object(
    'id', target.id,
    'kind', target.kind,
    'label', target.label,
    'storage_path', target.storage_path
  );
end;
$$;

revoke all on function public.delete_media_asset(uuid) from public, anon;
grant execute on function public.delete_media_asset(uuid) to authenticated;
