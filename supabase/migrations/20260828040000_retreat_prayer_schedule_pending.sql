-- A placeholder 21:00 schedule must not be presented as an actual church
-- commitment. Support an explicitly unconfigured prayer time and retain the
-- full retreat date range while D-Day continues to target the start date.
alter table public.app_settings
  add column if not exists retreat_end_date date;

alter table public.app_settings
  alter column daily_prayer_time drop not null,
  alter column daily_prayer_time drop default;

-- The original deployed table used PostgreSQL's generated name for this
-- table-level check. Replace it with a stable name so upgraded and fresh
-- installations share the same catalog shape.
alter table public.app_settings
  drop constraint if exists app_settings_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.app_settings'::regclass
      and conname = 'app_settings_retreat_date_range_check'
  ) then
    alter table public.app_settings
      add constraint app_settings_retreat_date_range_check
      check (retreat_end_date is null or retreat_date is null or retreat_end_date >= retreat_date);
  end if;
end
$$;

grant select (retreat_end_date) on public.app_settings to anon, authenticated;
grant update (retreat_end_date) on public.app_settings to authenticated;

update public.app_settings
set daily_prayer_time = null
where updated_by is null
  and daily_prayer_time = time '21:00';

update public.prayer_programs
set scheduled_for = null,
    status = 'draft',
    updated_at = clock_timestamp()
where id = '00000000-0000-4000-8000-000000000001'
  and created_by is null
  and status = 'published';

update public.live_sessions
set status = 'draft',
    scheduled_for = null,
    version = version + 1,
    updated_at = clock_timestamp()
where id = 1
  and program_id = '00000000-0000-4000-8000-000000000001'
  and status = 'scheduled'
  and started_at is null;
