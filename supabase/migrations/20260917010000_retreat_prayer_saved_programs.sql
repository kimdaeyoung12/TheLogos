-- Reusable copies are draft programs. Saving never touches live_sessions.
create or replace function public.save_prayer_program_template(
  p_id uuid, p_title text, p_mode public.live_mode, p_steps jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  step jsonb;
  seconds integer;
  media_id uuid;
  clean_steps jsonb := '[]'::jsonb;
  saved public.prayer_programs%rowtype;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode='insufficient_privilege';
  end if;
  if p_id is null or p_mode is null or char_length(trim(coalesce(p_title,''))) not between 1 and 120 then
    raise exception 'valid template id, title and mode required';
  end if;
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then raise exception 'steps must be an array'; end if;
  if jsonb_array_length(p_steps) not between 1 and 12 then raise exception 'program must contain 1 to 12 steps'; end if;
  for step in select value from jsonb_array_elements(p_steps) loop
    seconds := coalesce((step->>'duration_seconds')::integer,0);
    if char_length(trim(coalesce(step->>'label',''))) not between 1 and 80
      or char_length(trim(coalesce(step->>'content',''))) not between 1 and 1200
      or char_length(coalesce(step->>'scripture_reference',''))>80
      or coalesce(step->>'kind','prayer') not in ('scripture','prayer','request')
      or seconds not between 60 and 3600 then raise exception 'invalid program step'; end if;
    media_id:=nullif(step->>'media_id','')::uuid;
    if media_id is not null and not exists(select 1 from public.media_assets m where m.id=media_id and m.active and m.kind='audio') then
      raise exception 'active uploaded audio required';
    end if;
    clean_steps:=clean_steps||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id',coalesce(left(nullif(step->>'id',''),80),extensions.gen_random_uuid()::text),
      'label',trim(step->>'label'),'kind',coalesce(step->>'kind','prayer'),
      'content',trim(step->>'content'),'duration_seconds',seconds,
      'scripture_reference',nullif(trim(coalesce(step->>'scripture_reference','')),''),'media_id',media_id)));
  end loop;
  insert into public.prayer_programs(id,title,mode,steps,status,created_by,updated_by)
    values(p_id,trim(p_title),p_mode,clean_steps,'draft',caller,caller)
    on conflict(id) do nothing returning * into saved;
  if not found then
    select * into saved from public.prayer_programs where id=p_id;
    if saved.status<>'draft' or saved.created_by is distinct from caller or saved.title<>trim(p_title)
      or saved.mode<>p_mode or saved.steps<>clean_steps then
      raise exception 'save request already used for different content';
    end if;
  else
    insert into public.admin_audit(admin_id,action,target_type,target_id,details)
      values(caller,'program.template.save','prayer_program',saved.id::text,jsonb_build_object('steps',jsonb_array_length(clean_steps)));
  end if;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_prayer_program_template(uuid,text,public.live_mode,jsonb) from public,anon;
grant execute on function public.save_prayer_program_template(uuid,text,public.live_mode,jsonb) to authenticated;
