-- Minimal platform objects for offline PostgreSQL privilege/RLS tests only.
-- Does NOT emulate Auth hooks, PostgREST, Storage, Realtime delivery or Cron.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
create schema extensions;
create schema auth;
create schema storage;
create schema realtime;
create schema cron;
create table auth.users(id uuid primary key, is_anonymous boolean default false, created_at timestamptz default clock_timestamp());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema public,auth to anon,authenticated,service_role,supabase_auth_admin;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key,bucket_id text);
alter table storage.objects enable row level security;
create table realtime.messages(id bigint,extension text);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
create table cron.job(jobid bigint generated always as identity,jobname text unique,schedule text,command text,active boolean default true);
create function cron.schedule(name text,schedule text,command text) returns bigint language sql as $$
  insert into cron.job(jobname,schedule,command) values(name,schedule,command) returning jobid
$$;
create publication supabase_realtime;
