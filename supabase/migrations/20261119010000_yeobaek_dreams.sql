begin;
create schema if not exists yeobaek_private;
revoke all on schema yeobaek_private from public, anon, authenticated;
create table yeobaek_private.settings (
  singleton boolean primary key default true check (singleton),
  salt uuid not null default gen_random_uuid()
);
insert into yeobaek_private.settings default values;
create table yeobaek_private.dreams (
  request_id uuid primary key,
  notebook bytea not null,
  source_bucket bytea not null,
  body text not null check (char_length(body) between 5 and 400),
  created_at timestamptz not null default now()
);
create index on yeobaek_private.dreams (created_at);
create index on yeobaek_private.dreams (notebook,created_at desc);
create index on yeobaek_private.dreams (source_bucket,created_at desc);
alter table yeobaek_private.dreams enable row level security;
alter table yeobaek_private.settings enable row level security;
revoke all on all tables in schema yeobaek_private from public, anon, authenticated;

create function public.yeobaek_save(book_key text, entry_id uuid, dream text, website text default '')
returns text language plpgsql security definer set search_path = '' as $$
declare
  msg text := btrim(dream);
  owner_hash bytea;
  bucket bytea;
  hdr jsonb := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
begin
  if book_key is null or book_key !~ '^[0-9a-f]{64}$' or entry_id is null or msg is null
     or char_length(msg) not between 5 and 400 or website is distinct from ''
     or msg ~* '(https?://|www\.|[[:alnum:]_-]+\.(com|net|org|kr)(/|[[:space:]]|$))'
     or msg ~ '(.)\1{9}' then return 'invalid'; end if;
  owner_hash := sha256(convert_to(book_key,'UTF8'));
  select sha256(convert_to(salt::text || (now() at time zone 'UTC')::date::text ||
    coalesce(nullif(hdr->>'cf-connecting-ip',''),nullif(split_part(hdr->>'x-forwarded-for',',',1),''),'unknown'),'UTF8'))
    into bucket from yeobaek_private.settings;
  perform pg_advisory_xact_lock(621904217);
  if exists(select 1 from yeobaek_private.dreams where request_id=entry_id and notebook=owner_hash and body=msg) then return 'saved'; end if;
  if exists(select 1 from yeobaek_private.dreams where request_id=entry_id) then return 'invalid'; end if;
  if exists(select 1 from yeobaek_private.dreams where notebook=owner_hash and body=msg) then return 'duplicate'; end if;
  if (select count(*) from yeobaek_private.dreams where created_at>now()-interval '10 minutes')>=100
    or (select count(*) from yeobaek_private.dreams where source_bucket=bucket and created_at>now()-interval '10 minutes')>=10
    or (select count(*) from yeobaek_private.dreams where notebook=owner_hash and created_at>now()-interval '1 day')>=5
    then return 'limited'; end if;
  insert into yeobaek_private.dreams(request_id,notebook,source_bucket,body) values(entry_id,owner_hash,bucket,msg);
  return 'saved';
end $$;
create function public.yeobaek_read(book_key text)
returns table(body text, created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select d.body,d.created_at from yeobaek_private.dreams d
 where book_key ~ '^[0-9a-f]{64}$' and d.notebook=sha256(convert_to(book_key,'UTF8'))
 order by d.created_at desc limit 100
$$;
revoke all on function public.yeobaek_save(text,uuid,text,text), public.yeobaek_read(text) from public, authenticated, anon;
grant execute on function public.yeobaek_save(text,uuid,text,text), public.yeobaek_read(text) to anon;
notify pgrst,'reload schema';
commit;
