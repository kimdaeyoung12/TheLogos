-- Raise the active Admin capacity from five to ten while preserving the
-- transaction-level serialization and last-owner safety invariants.

create or replace function public.enforce_admin_safety()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_count integer;
  owner_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('retreat-prayer-admin-limit', 0));

  if tg_op in ('INSERT', 'UPDATE') and new.active then
    select count(*) into active_count
    from public.admin_profiles
    where active and user_id <> new.user_id;
    if active_count >= 10 then
      raise exception 'active admin limit is 10' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and old.active
     and (not new.active or new.role <> 'owner') then
    select count(*) into owner_count
    from public.admin_profiles
    where role = 'owner' and active and user_id <> old.user_id;
    if owner_count = 0 then
      raise exception 'the last active owner cannot be changed' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' and old.active then
    select count(*) into owner_count
    from public.admin_profiles
    where role = 'owner' and active and user_id <> old.user_id;
    if owner_count = 0 then
      raise exception 'the last active owner cannot be deleted' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
