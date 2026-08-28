-- Supabase's global signup switch also controls anonymous users, while the
-- email-provider switch controls both signup and password login. Keep both
-- providers available and enforce invite-only permanent accounts with a
-- one-time, server-generated nonce consumed by a Before User Created hook.

create table public.admin_invite_nonces (
  nonce_hash text primary key check (nonce_hash ~ '^[0-9a-f]{64}$'),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  check (expires_at > created_at)
);

create index admin_invite_nonces_expires_idx
  on public.admin_invite_nonces (expires_at);

alter table public.admin_invite_nonces enable row level security;
revoke all on public.admin_invite_nonces from public, anon, authenticated;
grant select, insert, delete on public.admin_invite_nonces to service_role;

create or replace function public.hook_restrict_retreat_prayer_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_is_anonymous boolean;
  signup_email text;
  invite_nonce text;
  consumed_nonce text;
begin
  user_is_anonymous := coalesce((event->'user'->>'is_anonymous')::boolean, false);
  if user_is_anonymous then
    return '{}'::jsonb;
  end if;

  signup_email := lower(trim(coalesce(event->'user'->>'email', '')));
  invite_nonce := coalesce(
    event->'user'->'user_metadata'->>'retreat_prayer_invite_nonce',
    ''
  );

  if signup_email <> '' and invite_nonce ~ '^[0-9a-f]{64}$' then
    delete from public.admin_invite_nonces
    where nonce_hash = encode(extensions.digest(invite_nonce, 'sha256'), 'hex')
      and email_hash = encode(extensions.digest(signup_email, 'sha256'), 'hex')
      and expires_at > clock_timestamp()
    returning nonce_hash into consumed_nonce;

    if consumed_nonce is not null then
      return '{}'::jsonb;
    end if;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', '이 서비스는 관리자 초대로만 가입할 수 있습니다.'
    )
  );
end;
$$;

revoke all on function public.hook_restrict_retreat_prayer_signup(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.hook_restrict_retreat_prayer_signup(jsonb)
  to supabase_auth_admin;

create or replace function public.purge_expired_prayer_requests()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
  rate_limit_count integer;
  anonymous_user_count integer;
  invite_nonce_count integer;
begin
  delete from public.prayer_requests where expires_at <= clock_timestamp();
  get diagnostics deleted_count = row_count;
  delete from public.submission_rate_limits
  where resets_at <= clock_timestamp() - interval '24 hours';
  get diagnostics rate_limit_count = row_count;
  delete from auth.users
  where is_anonymous is true
    and created_at <= clock_timestamp() - interval '30 days';
  get diagnostics anonymous_user_count = row_count;
  delete from public.admin_invite_nonces
  where expires_at <= clock_timestamp();
  get diagnostics invite_nonce_count = row_count;
  return deleted_count + rate_limit_count + anonymous_user_count + invite_nonce_count;
end;
$$;

revoke all on function public.purge_expired_prayer_requests() from public, anon, authenticated;
grant execute on function public.purge_expired_prayer_requests() to service_role;
