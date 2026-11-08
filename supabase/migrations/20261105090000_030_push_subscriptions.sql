-- 030: Web Push device registration (Phase 2 of push notifications).
--
-- One row per browser/device that an admin enabled notifications on. Rows are
-- written only through the RPCs below; the push keys are never readable by
-- any client role. Sending happens in an Edge Function with the service role.
-- Additive only: no existing table, policy or function is changed.

begin;

create table public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  member_id        uuid not null references public.profiles(id) on delete cascade,
  endpoint         text not null,
  p256dh           text not null,
  auth_secret      text not null,
  device_label     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_success_at  timestamptz,
  failure_count    integer not null default 0,
  revoked_at       timestamptz,
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_endpoint_check
    check (char_length(endpoint) between 20 and 1000 and endpoint ~ '^https://'),
  constraint push_subscriptions_p256dh_check
    check (char_length(p256dh) between 80 and 120 and p256dh ~ '^[A-Za-z0-9_-]+=*$'),
  constraint push_subscriptions_auth_secret_check
    check (char_length(auth_secret) between 16 and 40 and auth_secret ~ '^[A-Za-z0-9_-]+=*$'),
  constraint push_subscriptions_device_label_check
    check (device_label is null or char_length(btrim(device_label)) between 1 and 60),
  constraint push_subscriptions_failure_count_check check (failure_count >= 0)
);

comment on table public.push_subscriptions is
  'Web Push subscriptions of admin devices. Written only via RPCs; read only by the service role.';

create index push_subscriptions_owner_active_idx
  on public.push_subscriptions (owner_id) where revoked_at is null;
create index push_subscriptions_member_idx
  on public.push_subscriptions (member_id);

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

-- No client role touches this table directly. New public tables here get
-- TRUNCATE/REFERENCES/TRIGGER for anon and authenticated by default, so
-- everything is revoked explicitly. RLS is on with no policies.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
-- service_role gets REFERENCES/TRIGGER/TRUNCATE from the project default ACL; it only needs the RPCs below.
revoke references, trigger, truncate on table public.push_subscriptions from service_role;

-- Only real push services are accepted, so the sender never posts to an
-- arbitrary URL. Chrome/Android/Edge-on-Android: FCM. Safari/iOS: Apple.
-- Firefox: Mozilla. Edge on Windows: WNS.
create or replace function private.is_allowed_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/', false);
$$;

create or replace function private.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_device_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (select auth.uid());
  v_owner_id uuid := (select private.current_business_owner_id());
  v_label text := nullif(btrim(coalesce(p_device_label, '')), '');
  v_id uuid;
begin
  if v_member_id is null or v_owner_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if not private.is_allowed_push_endpoint(p_endpoint) then
    raise exception using errcode = 'P0001', message = 'Unsupported push endpoint';
  end if;

  -- The endpoint identifies the browser on this device. Enabling again (or
  -- from another admin login on the same device) takes the row over and
  -- reactivates it instead of creating a duplicate.
  insert into public.push_subscriptions (
    owner_id, member_id, endpoint, p256dh, auth_secret, device_label
  ) values (
    v_owner_id, v_member_id, p_endpoint, p_p256dh, p_auth_secret, left(v_label, 60)
  )
  on conflict (endpoint) do update
    set owner_id = excluded.owner_id,
        member_id = excluded.member_id,
        p256dh = excluded.p256dh,
        auth_secret = excluded.auth_secret,
        device_label = excluded.device_label,
        failure_count = 0,
        revoked_at = null
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function private.revoke_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  update public.push_subscriptions
  set revoked_at = now()
  where endpoint = p_endpoint
    and member_id = (select auth.uid())
    and revoked_at is null;

  return found;
end;
$$;

-- Lists the caller's own active devices for the settings screen. Never
-- returns endpoints or keys; the current device is marked by comparing the
-- endpoint the browser already holds.
create or replace function private.list_my_push_devices(p_current_endpoint text)
returns table (
  id uuid,
  device_label text,
  created_at timestamptz,
  last_success_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    subscription.id,
    subscription.device_label,
    subscription.created_at,
    subscription.last_success_at,
    subscription.endpoint = p_current_endpoint
  from public.push_subscriptions as subscription
  where subscription.member_id = (select auth.uid())
    and subscription.owner_id = (select private.current_business_owner_id())
    and subscription.revoked_at is null
  order by subscription.created_at desc;
$$;

revoke all on function private.is_allowed_push_endpoint(text) from public, anon, authenticated;
revoke all on function private.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function private.revoke_push_subscription(text) from public, anon;
revoke all on function private.list_my_push_devices(text) from public, anon;
grant execute on function private.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function private.revoke_push_subscription(text) to authenticated;
grant execute on function private.list_my_push_devices(text) to authenticated;

create or replace function public.register_my_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_device_label text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.register_push_subscription(p_endpoint, p_p256dh, p_auth_secret, p_device_label);
$$;

create or replace function public.revoke_my_push_subscription(p_endpoint text)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.revoke_push_subscription(p_endpoint);
$$;

create or replace function public.list_my_push_devices(p_current_endpoint text default null)
returns table (
  id uuid,
  device_label text,
  created_at timestamptz,
  last_success_at timestamptz,
  is_current boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_my_push_devices(p_current_endpoint);
$$;

revoke all on function public.register_my_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.revoke_my_push_subscription(text) from public, anon;
revoke all on function public.list_my_push_devices(text) from public, anon;
grant execute on function public.register_my_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.revoke_my_push_subscription(text) to authenticated;
grant execute on function public.list_my_push_devices(text) to authenticated;

-- Server side (Edge Function, service role). On this project service_role has
-- no SELECT/UPDATE on public tables, and no USAGE on schema private, so the
-- sender gets exactly two narrow functions instead of table grants.

-- Active devices of one admin who is still an active admin of a business.
create or replace function public.push_targets_for_member(p_member_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth_secret text)
language sql
stable
security definer
set search_path = ''
as $$
  select subscription.id, subscription.endpoint, subscription.p256dh, subscription.auth_secret
  from public.push_subscriptions as subscription
  join public.business_admins as membership
    on membership.member_id = subscription.member_id
   and membership.business_owner_id = subscription.owner_id
   and membership.is_active = true
  join public.profiles as profile
    on profile.id = subscription.member_id
   and profile.role = 'admin'
  where subscription.member_id = p_member_id
    and subscription.revoked_at is null;
$$;

-- Records delivery outcomes: [{"id": uuid, "outcome": "ok" | "gone" | "error"}].
-- "gone" (HTTP 404/410) revokes that device only; five errors in a row too.
create or replace function public.record_push_results(p_results jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_results) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'Results must be an array';
  end if;

  update public.push_subscriptions as subscription
  set last_success_at = case when result.outcome = 'ok' then now() else subscription.last_success_at end,
      failure_count = case when result.outcome = 'ok' then 0 else subscription.failure_count + 1 end,
      revoked_at = case
        when result.outcome = 'gone' then now()
        when result.outcome = 'error' and subscription.failure_count + 1 >= 5 then now()
        else subscription.revoked_at
      end
  from jsonb_to_recordset(p_results) as result(id uuid, outcome text)
  where subscription.id = result.id
    and subscription.revoked_at is null
    and result.outcome in ('ok', 'gone', 'error');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.push_targets_for_member(uuid) from public, anon, authenticated;
revoke all on function public.record_push_results(jsonb) from public, anon, authenticated;
grant execute on function public.push_targets_for_member(uuid) to service_role;
grant execute on function public.record_push_results(jsonb) to service_role;

commit;
