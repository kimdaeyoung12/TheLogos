begin;
set local role anon;
do $$
declare
  owner_key text := repeat('a',64);
  other_key text := repeat('b',64);
  message text := '책 세 권을 골라 친구를 초대하고 싶어요.';
begin
  assert public.yeobaek_save(owner_key,gen_random_uuid(),message,'')='saved';
  assert not exists(select from public.yeobaek_gallery(null,null,null) where body=message);
  assert not public.yeobaek_share(other_key,message,'관계');
  assert not public.yeobaek_share(owner_key,message,'잘못된 주제');
  assert public.yeobaek_share(owner_key,message,'관계');
  assert exists(select from public.yeobaek_gallery('관계',null,null) where body=message);
  assert not exists(select from public.yeobaek_gallery('창작',null,null) where body=message);
  assert exists(select from public.yeobaek_topics() where topic='관계' and total>=1);
  assert not exists(select from public.yeobaek_my_shares(other_key) where body=message);
  assert not public.yeobaek_share(other_key,message,null);
  assert public.yeobaek_share(owner_key,message,null);
  assert not exists(select from public.yeobaek_gallery(null,null,null) where body=message);
  assert exists(select from public.yeobaek_read(owner_key) where body=message);
end $$;
rollback;
