begin;
-- A null topic is private, including every notebook written before the atlas.
alter table yeobaek_private.dreams add column shared_topic text
  check (shared_topic in ('관계','배움','창작','일상','일과 진로','기타'));
create index yeobaek_shared_topics on yeobaek_private.dreams(shared_topic, created_at desc, request_id desc)
  where shared_topic is not null;

create function public.yeobaek_share(book_key text, dream text, topic text)
returns boolean language sql security definer set search_path='' as $$
  with changed as (
    update yeobaek_private.dreams set shared_topic=topic
    where book_key ~ '^[0-9a-f]{64}$' and notebook=sha256(convert_to(book_key,'UTF8'))
      and body=dream and (topic is null or topic in ('관계','배움','창작','일상','일과 진로','기타'))
    returning 1
  ) select exists(select from changed)
$$;
create function public.yeobaek_topics()
returns table(topic text, total bigint) language sql stable security definer set search_path='' as $$
  select shared_topic,count(*) from yeobaek_private.dreams where shared_topic is not null group by shared_topic
$$;
create function public.yeobaek_gallery(chosen text, before_date timestamptz, before_id uuid)
returns table(id uuid,topic text,body text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select d.request_id,d.shared_topic,d.body,d.created_at from yeobaek_private.dreams d
  where d.shared_topic is not null and (chosen is null or d.shared_topic=chosen)
    and (before_date is null or (d.created_at,d.request_id)<(before_date,before_id))
  order by d.created_at desc,d.request_id desc limit 13
$$;
create function public.yeobaek_my_shares(book_key text)
returns table(body text, topic text) language sql stable security definer set search_path='' as $$
  select d.body,d.shared_topic from yeobaek_private.dreams d where book_key ~ '^[0-9a-f]{64}$'
  and d.notebook=sha256(convert_to(book_key,'UTF8')) and d.shared_topic is not null
  order by d.created_at desc
$$;
revoke all on function public.yeobaek_share(text,text,text),public.yeobaek_topics(),public.yeobaek_gallery(text,timestamptz,uuid),public.yeobaek_my_shares(text) from public,anon,authenticated;
grant execute on function public.yeobaek_share(text,text,text),public.yeobaek_topics(),public.yeobaek_gallery(text,timestamptz,uuid),public.yeobaek_my_shares(text) to anon;
notify pgrst,'reload schema';
commit;
