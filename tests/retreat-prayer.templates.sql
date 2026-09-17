-- Run inside a transaction with the migration; rollback after these assertions.
do $$
declare
  owner_id uuid;
  template_id uuid := extensions.gen_random_uuid();
  saved jsonb;
  live_before jsonb;
  steps jsonb := '[{"id":"one","label":"Test prayer","kind":"prayer","content":"Test only, rolled back","duration_seconds":180}]'::jsonb;
begin
  select user_id into owner_id from public.admin_profiles where active and role='owner' limit 1;
  if owner_id is null then raise exception 'Test needs existing active owner'; end if;
  select to_jsonb(s) into live_before from public.live_sessions s where id=1;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  saved:=public.save_prayer_program_template(template_id,'Rollback test','manual',steps);
  if saved->>'status'<>'draft' or saved->>'scheduled_for' is not null then raise exception 'Not a reusable draft'; end if;
  if saved is distinct from public.save_prayer_program_template(template_id,'Rollback test','manual',steps) then raise exception 'Retry not idempotent'; end if;
  begin
    perform public.save_prayer_program_template(extensions.gen_random_uuid(),'Invalid','manual',null);
    raise exception 'NULL accepted';
  exception when raise_exception then
    if sqlerrm='NULL accepted' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',extensions.gen_random_uuid()::text,true);
  begin
    perform public.save_prayer_program_template(extensions.gen_random_uuid(),'Unauthorized','manual',steps);
    raise exception 'Non-admin accepted';
  exception when insufficient_privilege then null;
  end;
  if (select to_jsonb(s) from public.live_sessions s where id=1) is distinct from live_before then raise exception 'Live state changed'; end if;
  if has_function_privilege('anon','public.save_prayer_program_template(uuid,text,public.live_mode,jsonb)','EXECUTE') then raise exception 'Anon can execute'; end if;
end;
$$;
