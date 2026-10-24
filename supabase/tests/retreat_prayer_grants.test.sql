-- Run as postgres after all migrations, on a disposable Supabase database.
-- Works with psql -v ON_ERROR_STOP=1 -f; every fixture is rolled back.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception '%', message; end if;
end $$;
create function pg_temp.expect_denied(statement text) returns void
language plpgsql as $$ begin
  begin
    execute statement;
  exception when insufficient_privilege then return;
  end;
  raise exception 'Expected insufficient_privilege: %', statement;
end $$;

-- Exact browser column matrix, including denied operations. Column checks
-- include inherited table grants, which has_table_privilege alone misses.
create temp table expected_browser (
  table_name text primary key, readable text[], writable text[] default '{}',
  insertable boolean default false
);
insert into expected_browser(table_name, readable, writable, insertable) values
('app_settings', array['id','app_name','church_name','retreat_date','retreat_end_date','time_zone','daily_prayer_time','emergency_notice','updated_at'], array['church_name','retreat_date','retreat_end_date','daily_prayer_time'], false),
('content_revisions', array['id','revision','updated_at'], '{}', false),
('admin_profiles', null, '{}', false),
('daily_prayers', array['id','prayer_date','scripture_reference','scripture_text','prayer_topic','published','created_at','updated_at'], null, true),
('prayer_programs', null, '{}', false),
('live_sessions', array['id','status','mode','scheduled_for','program_id','program_snapshot','stage_index','started_at','stage_started_at','paused_at','accumulated_pause_seconds','paused_remaining_seconds','announcement','media','version','updated_at','announcement_id','announcement_created_at'], '{}', false),
('live_controller_leases', '{}', '{}', false),
('prayer_requests', array['id','display_name','is_anonymous','body','status','approved_at','created_at'], array['status','approved_at'], false),
('media_assets', array['id','kind','label','source_url','storage_path','start_seconds','active','created_at'], null, true),
('admin_audit', null, '{}', false),
('submission_rate_limits', '{}', '{}', false),
('admin_invite_nonces', '{}', '{}', false);

do $$
declare t record; c record; r text; op text; expected boolean;
begin
  -- A newly added public table must acquire an explicit access contract here.
  perform pg_temp.check_true(
    (select array_agg(relname::text order by relname) from pg_class
     where relnamespace='public'::regnamespace and relkind in ('r','p')) =
    (select array_agg(table_name order by table_name) from expected_browser),
    'Public table inventory differs from the reviewed access contract');
  for t in select * from expected_browser loop
    perform pg_temp.check_true((select relrowsecurity from pg_class
      where oid=format('public.%I',t.table_name)::regclass), 'RLS disabled: '||t.table_name);
    foreach r in array array['anon','authenticated'] loop
      foreach op in array array['DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        perform pg_temp.check_true(not has_table_privilege(r,format('public.%I',t.table_name),op),
          r||' unexpected '||op||' on '||t.table_name);
      end loop;
      for c in select attname from pg_attribute
        where attrelid=format('public.%I',t.table_name)::regclass and attnum>0 and not attisdropped loop
        foreach op in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
          expected := case op
            when 'SELECT' then case when t.readable is null then r='authenticated' else c.attname=any(t.readable) end
            when 'INSERT' then r='authenticated' and t.insertable
            when 'UPDATE' then r='authenticated' and (t.writable is null or c.attname=any(t.writable))
            else false end;
          perform pg_temp.check_true(has_column_privilege(r,format('public.%I',t.table_name),c.attname,op)=expected,
            format('%s %s.%s %s differs from contract',r,t.table_name,c.attname,op));
        end loop;
      end loop;
    end loop;
  end loop;
  foreach op in array array['SELECT','INSERT'] loop
    perform pg_temp.check_true(has_table_privilege('service_role','public.prayer_requests',op), 'service prayer '||op||' missing');
  end loop;
  foreach op in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    perform pg_temp.check_true(has_table_privilege('service_role','public.admin_profiles',op), 'service profile '||op||' missing');
  end loop;
  perform pg_temp.check_true(has_table_privilege('service_role','public.admin_audit','INSERT'), 'service audit INSERT missing');
  foreach op in array array['SELECT','INSERT','DELETE'] loop
    perform pg_temp.check_true(has_table_privilege('service_role','public.admin_invite_nonces',op), 'service nonce '||op||' missing');
  end loop;
end $$;

-- Random IDs avoid depending on real users; use a disposable DB regardless.
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.admin',gen_random_uuid()::text,true);
select set_config('test.participant',gen_random_uuid()::text,true);
select set_config('test.pending',gen_random_uuid()::text,true);
select set_config('test.approved',gen_random_uuid()::text,true);
select set_config('test.expired',gen_random_uuid()::text,true);
select set_config('test.hidden',gen_random_uuid()::text,true);
insert into auth.users(id) values
(current_setting('test.owner')::uuid),(current_setting('test.admin')::uuid),
(current_setting('test.participant')::uuid);
insert into public.admin_profiles(user_id,display_name,role) values
(current_setting('test.owner')::uuid,'grant-test-owner','owner'),
(current_setting('test.admin')::uuid,'grant-test-admin','admin');
insert into public.prayer_requests(id,display_name,body,public_consent,status,submitted_session_hash,submitted_ip_hash,expires_at)
select current_setting('test.'||s)::uuid,'grant-test','private fixture body',true,
  case s when 'expired' then 'approved' else s end::public.prayer_request_status,
  'private-session','private-ip',clock_timestamp()+case s when 'expired' then interval '-1 day' else interval '1 day' end
from unnest(array['pending','approved','expired','hidden']) s;

insert into public.daily_prayers(prayer_date,prayer_topic,published)
values ('2199-01-01','grant-test-public',true),('2199-01-02','grant-test-private',false);
insert into public.media_assets(kind,label,source_url,active)
values ('youtube','grant-test-public','https://example.com/public',true),
('youtube','grant-test-private','https://example.com/private',false);

set local role anon;
select pg_temp.check_true((select count(*) from public.daily_prayers where prayer_date in ('2199-01-01','2199-01-02'))=1,'anon sees unpublished prayer');
select pg_temp.check_true((select count(*) from public.media_assets where label like 'grant-test-%')=1,'anon sees inactive media');
select id,app_name,church_name from public.app_settings;
select id,revision from public.content_revisions;
select id,status,announcement_id,announcement_created_at from public.live_sessions;
select pg_temp.check_true((select count(*) from public.prayer_requests where id in
  (current_setting('test.pending')::uuid,current_setting('test.approved')::uuid,
   current_setting('test.expired')::uuid,current_setting('test.hidden')::uuid))=1,'anon must see only unexpired approved request');
select pg_temp.expect_denied('select submitted_session_hash from public.prayer_requests');
select pg_temp.expect_denied('select * from public.admin_profiles');
select pg_temp.expect_denied('select * from public.admin_audit');
select pg_temp.expect_denied('select * from public.admin_invite_nonces');
select pg_temp.expect_denied('insert into public.prayer_requests default values');
reset role;

select set_config('request.jwt.claim.sub',current_setting('test.participant'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.participant'),'is_anonymous',true)::text,true);
set local role authenticated;
select pg_temp.check_true((select count(*) from public.prayer_requests where id in
  (current_setting('test.pending')::uuid,current_setting('test.approved')::uuid,
   current_setting('test.expired')::uuid,current_setting('test.hidden')::uuid))=1,'Anonymous Auth participant request isolation');
select pg_temp.check_true((select count(*) from public.daily_prayers where prayer_date in ('2199-01-01','2199-01-02'))=1,'participant sees unpublished prayer');
select pg_temp.check_true((select count(*) from public.media_assets where label like 'grant-test-%')=1,'participant sees inactive media');
select pg_temp.check_true((select count(*) from public.admin_profiles)=0,'participant sees admin profiles');
select pg_temp.check_true((select count(*) from public.admin_audit)=0,'participant sees admin audit');
select pg_temp.check_true((select count(*) from public.prayer_programs)=0,'participant sees draft programs');
select pg_temp.expect_denied('select submitted_ip_hash from public.prayer_requests');
select pg_temp.expect_denied('select * from public.live_controller_leases');
select pg_temp.expect_denied('select * from public.submission_rate_limits');
select pg_temp.expect_denied('select * from public.admin_invite_nonces');
select pg_temp.expect_denied('insert into public.prayer_requests default values');
select pg_temp.expect_denied('insert into public.admin_profiles default values');
select pg_temp.expect_denied('select public.consume_submission_quota(''bad'',''bad'')');
-- A permitted column UPDATE must still affect zero rows for a non-admin.
update public.prayer_requests set status='approved' where id=current_setting('test.pending')::uuid;
reset role;
select pg_temp.check_true((select status='pending' from public.prayer_requests where id=current_setting('test.pending')::uuid),'participant moderated a request');

select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'))::text,true);
set local role authenticated;
select pg_temp.check_true((select count(*) from public.prayer_requests where id in
  (current_setting('test.pending')::uuid,current_setting('test.approved')::uuid,
   current_setting('test.expired')::uuid,current_setting('test.hidden')::uuid))=4,'admin cannot moderate private rows');
select pg_temp.check_true((select count(*) from public.admin_profiles where user_id in
  (current_setting('test.owner')::uuid,current_setting('test.admin')::uuid))=1,'admin profile self-only RLS');
select pg_temp.check_true((select count(*) from public.daily_prayers where prayer_date in ('2199-01-01','2199-01-02'))=2,'admin cannot read drafts');
select pg_temp.check_true((select count(*) from public.media_assets where label like 'grant-test-%')=2,'admin cannot read inactive media');
select pg_temp.expect_denied('select submitted_session_hash from public.prayer_requests');
update public.prayer_requests set status='approved' where id=current_setting('test.pending')::uuid;
select pg_temp.check_true((select count(*) from public.admin_audit where target_id=current_setting('test.pending'))=1,'moderation audit trigger failed');
-- RPCs still work without direct INSERT grants on prayer_programs/admin_audit.
select public.save_prayer_program_template(gen_random_uuid(),'grant-test-template','manual',
  '[{"id":"one","label":"Prayer","content":"Prayer content","duration_seconds":60}]');
reset role;

select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'))::text,true);
set local role authenticated;
select pg_temp.check_true((select count(*) from public.admin_profiles where user_id in
  (current_setting('test.owner')::uuid,current_setting('test.admin')::uuid))=2,'owner cannot read admin profiles');
reset role;
-- No caller identity is supplied to the server-only service client.
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);

-- Exercise the SQL operations used by Edge Functions under the actual role.
-- Identity insert must work with no new sequence USAGE grant.
set local role service_role;
select pg_temp.check_true(public.consume_submission_quota('grant-test-session',null),'service quota RPC failed');
insert into public.prayer_requests(display_name,is_anonymous,body,public_consent,status,submitted_session_hash,submitted_ip_hash)
values('grant-test',true,'edge pending prayer',true,'pending','session','ip') returning id,status;
select user_id,display_name,role,active,created_at,updated_at from public.admin_profiles where user_id=current_setting('test.owner')::uuid;
insert into public.admin_invite_nonces(nonce_hash,email_hash,created_by,expires_at)
values(repeat('a',64),repeat('b',64),current_setting('test.owner')::uuid,clock_timestamp()+interval '10 minutes');
delete from public.admin_invite_nonces where nonce_hash=repeat('a',64);
insert into public.admin_profiles(user_id,display_name,role,active)
values(current_setting('test.participant')::uuid,'grant-test-invite','admin',true)
returning user_id,display_name,role,active,created_at;
update public.admin_profiles set active=false where user_id=current_setting('test.participant')::uuid returning user_id,display_name,role,active;
update public.admin_profiles set active=true where user_id=current_setting('test.participant')::uuid;
insert into public.admin_audit(admin_id,action,target_type,target_id,details)
values(current_setting('test.owner')::uuid,'admin.invite','admin_profile',current_setting('test.participant'),'{}');
delete from public.admin_profiles where user_id=current_setting('test.participant')::uuid;
reset role;
rollback;
