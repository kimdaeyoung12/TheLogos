-- New public tables no longer inherit API grants after 2026-10-30.
-- Only these operations are used directly by the two Edge Functions.
-- SECURITY DEFINER RPCs/triggers access other tables as their owner.
-- Keep browser column grants and RLS unchanged; do not restore broad defaults.
grant select, insert on public.prayer_requests to service_role;
grant select, insert, update, delete on public.admin_profiles to service_role;
grant insert on public.admin_audit to service_role;
-- admin_audit.id is GENERATED ALWAYS AS IDENTITY: INSERT does not require
-- a separate sequence USAGE grant (unlike a serial/nextval default).
