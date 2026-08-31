-- Give an active Admin console enough time to survive background-tab timer
-- throttling while retaining the single-controller invariant.
create or replace function public.claim_live_controller(p_lease_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  lease public.live_controller_leases%rowtype;
  holder_name text;
begin
  if caller is null or not public.is_active_admin() then
    raise exception 'active admin permission required' using errcode = 'insufficient_privilege';
  end if;

  if p_lease_token is null then
    raise exception 'a live control lease token is required' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.live_controller_leases (id) values (1) on conflict (id) do nothing;
  select * into lease from public.live_controller_leases where id = 1 for update;

  if lease.controller_id is null or lease.expires_at is null or lease.expires_at <= clock_timestamp()
     or (lease.controller_id = caller and lease.lease_token is not distinct from p_lease_token) then
    update public.live_controller_leases
    set controller_id = caller,
        lease_token = p_lease_token,
        expires_at = clock_timestamp() + interval '90 seconds',
        updated_at = clock_timestamp()
    where id = 1
    returning * into lease;
    return jsonb_build_object(
      'acquired', true,
      'lease_token', lease.lease_token,
      'expires_at', lease.expires_at
    );
  end if;

  select display_name into holder_name from public.admin_profiles where user_id = lease.controller_id;
  return jsonb_build_object(
    'acquired', false,
    'controller_name', coalesce(holder_name, '다른 Admin'),
    'expires_at', lease.expires_at,
    'message', '다른 Admin이 현재 기도회를 제어하고 있습니다.'
  );
end;
$$;

revoke all on function public.claim_live_controller(uuid) from public;
grant execute on function public.claim_live_controller(uuid) to authenticated;
