-- Run as the database owner after migrations against a disposable database:
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/retreat_prayer_event_quota.test.sql
-- All test rows are isolated with a random prefix and rolled back.
begin;

do $$
declare
  test_prefix text := 'quota-test-' || gen_random_uuid()::text;
  shared_ip text := test_prefix || '-wifi';
  participant integer;
  attempt integer;
  observed_count integer;
begin
  -- All 50 participants can submit three requests from the same Wi-Fi.
  for participant in 1..50 loop
    for attempt in 1..3 loop
      if not public.consume_submission_quota(test_prefix || '-user-' || participant, shared_ip) then
        raise exception 'Shared Wi-Fi blocked participant %, request %', participant, attempt;
      end if;
    end loop;
  end loop;

  select request_count into observed_count
  from public.submission_rate_limits
  where bucket = 'ip-1h' and key_hash = shared_ip;
  if observed_count is distinct from 150 then
    raise exception 'Expected exactly 150 counted shared-IP attempts, got %', observed_count;
  end if;
  if public.consume_submission_quota(test_prefix || '-overflow', shared_ip) then
    raise exception 'The 151st shared-IP attempt must be rejected';
  end if;

  -- A separate IP confirms that the fourth session attempt is rejected on its own.
  for attempt in 1..3 loop
    if not public.consume_submission_quota(test_prefix || '-single', test_prefix || '-other-ip') then
      raise exception 'A session must allow its first three attempts';
    end if;
  end loop;
  if public.consume_submission_quota(test_prefix || '-single', test_prefix || '-other-ip') then
    raise exception 'A session must reject its fourth attempt';
  end if;

  -- Expiring both windows restores service without losing the window durations.
  update public.submission_rate_limits
  set resets_at = clock_timestamp() - interval '1 second'
  where (bucket = 'session-10m' and key_hash = test_prefix || '-user-1')
     or (bucket = 'ip-1h' and key_hash = shared_ip);
  if not public.consume_submission_quota(test_prefix || '-user-1', shared_ip) then
    raise exception 'Expired windows must allow a new request';
  end if;
  if (select count(*) from public.submission_rate_limits
      where ((bucket = 'session-10m' and key_hash = test_prefix || '-user-1')
          or (bucket = 'ip-1h' and key_hash = shared_ip))
        and request_count = 1
        and resets_at > clock_timestamp() + case bucket
          when 'session-10m' then interval '9 minutes'
          else interval '59 minutes' end) <> 2 then
    raise exception 'Expired windows must reset their count and renew their expiry';
  end if;

  -- Missing IP information must retain the per-session protection.
  for attempt in 1..3 loop
    if not public.consume_submission_quota(test_prefix || '-no-ip', null) then
      raise exception 'A session without IP must allow its first three attempts';
    end if;
  end loop;
  if public.consume_submission_quota(test_prefix || '-no-ip', null) then
    raise exception 'A session without IP must reject its fourth attempt';
  end if;

  if has_function_privilege('anon', 'public.consume_submission_quota(text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.consume_submission_quota(text,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.consume_submission_quota(text,text)', 'EXECUTE') then
    raise exception 'Quota function must remain callable only by the service role';
  end if;
end;
$$;

rollback;
