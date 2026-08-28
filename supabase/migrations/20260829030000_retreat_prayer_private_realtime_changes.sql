-- Realtime public access is disabled for this project. Authorize the two
-- read-only Postgres Changes channel topics used by participant and Admin
-- clients; table RLS still decides which changed rows each JWT may receive.

drop policy if exists retreat_prayer_postgres_changes_read on realtime.messages;

create policy retreat_prayer_postgres_changes_read
on realtime.messages for select to authenticated
using (
  realtime.topic() in ('retreat-prayer:live-state', 'retreat-prayer:public-content')
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'retreat_prayer_postgres_changes_read'
  ) then
    raise exception 'private Postgres Changes policy is incomplete';
  end if;
end
$$;
