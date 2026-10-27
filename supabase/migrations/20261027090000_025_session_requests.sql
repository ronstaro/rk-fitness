begin;

-- 025: A trainee asks for an in-person session and attaches a payment proof.
-- The request is not a session: only an admin approval creates the official
-- training_sessions row and, optionally, a paid row in the existing payments
-- ledger (trainee_monthly_payments, source = 'session_request').
--
-- Every write goes through the functions below. The table has no INSERT,
-- UPDATE or DELETE policy, so a trainee can never approve, re-date or
-- re-point a request, and nobody creates sessions or payments through it.
-- "Today" and "now" are always Israel time, like the rest of the app.

-- A session payment can share a month with the trainee's subscription row.
-- Only automatic and hand-added rows keep one row per trainee and month, so
-- the monthly logic and the "restore removed row" flow behave as before.
alter table public.trainee_monthly_payments
  drop constraint trainee_monthly_payments_owner_trainee_month_key;

create unique index trainee_monthly_payments_owner_trainee_month_key
  on public.trainee_monthly_payments (owner_id, trainee_id, billing_month)
  where source in ('monthly', 'manual');

create table public.session_requests (
  id                   uuid primary key,
  owner_id             uuid not null references public.profiles(id) on delete cascade,
  trainee_id           uuid not null,
  requested_date       date not null,
  requested_start_time time not null,
  trainee_note         text,
  payment_proof_path   text not null,
  status               text not null default 'pending',
  decision_note        text,
  decided_at           timestamptz,
  decided_by           uuid references public.profiles(id) on delete set null,
  scheduled_session_id uuid unique references public.training_sessions(id) on delete set null,
  payment_id           uuid unique references public.trainee_monthly_payments(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint session_requests_trainee_owner_fk
    foreign key (trainee_id, owner_id)
    references public.trainees(id, owner_id)
    on delete cascade,
  constraint session_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint session_requests_decision_check
    check ((status = 'pending') = (decided_at is null)),
  constraint session_requests_trainee_note_check
    check (trainee_note is null or char_length(btrim(trainee_note)) between 1 and 500),
  constraint session_requests_decision_note_check
    check (decision_note is null or char_length(btrim(decision_note)) between 1 and 500),
  -- {trainee_id}/{request_id}/{file}: the proof sits in its own request's folder.
  constraint session_requests_proof_path_check
    check (
      payment_proof_path = trainee_id::text || '/' || id::text || '/' || split_part(payment_proof_path, '/', 3)
      and payment_proof_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    ),
  constraint session_requests_proof_path_key unique (payment_proof_path)
);

comment on table public.session_requests is
  'Trainee requests for an in-person session. Approval creates the training_sessions row.';

create unique index session_requests_pending_slot_key
  on public.session_requests (trainee_id, requested_date, requested_start_time)
  where status = 'pending';
create index session_requests_owner_status_idx
  on public.session_requests (owner_id, status, requested_date);
create index session_requests_trainee_created_idx
  on public.session_requests (trainee_id, created_at desc);
create index session_requests_trainee_owner_idx
  on public.session_requests (trainee_id, owner_id);
create index session_requests_decided_by_idx
  on public.session_requests (decided_by)
  where decided_by is not null;

create trigger session_requests_updated_at
  before update on public.session_requests
  for each row execute function public.set_updated_at();

alter table public.session_requests enable row level security;

revoke all on public.session_requests from anon, authenticated;
grant select on public.session_requests to authenticated;

create policy "session_requests: authorized read"
  on public.session_requests for select
  to authenticated
  using (
    owner_id = (select private.current_business_owner_id())
    or (
      (select private.auth_user_role()) = 'trainee'
      and trainee_id = (select private.current_trainee_id())
    )
  );

-- Private bucket for payment proofs: {trainee_id}/{request_id}/{uuid}.{ext}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "payment proofs: trainee upload own new request"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (select private.auth_user_role()) = 'trainee'
    and (storage.foldername(name))[1] = (select private.current_trainee_id())::text
    and array_length(storage.foldername(name), 1) = 2
    and not exists (
      select 1
      from public.session_requests as request
      where request.id::text = (storage.foldername(name))[2]
    )
  );

create policy "payment proofs: authorized read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (
        (select private.auth_user_role()) = 'trainee'
        and (storage.foldername(name))[1] = (select private.current_trainee_id())::text
      )
      or exists (
        select 1
        from public.trainees as trainee
        where trainee.id::text = (storage.foldername(name))[1]
          and trainee.owner_id = (select private.current_business_owner_id())
      )
    )
  );

-- A trainee removes only a file no request uses (cleanup after a failed
-- submit). An admin removes own-business proofs (full trainee deletion).
create policy "payment proofs: authorized delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (
        (select private.auth_user_role()) = 'trainee'
        and (storage.foldername(name))[1] = (select private.current_trainee_id())::text
        and not exists (
          select 1
          from public.session_requests as request
          where request.payment_proof_path = objects.name
        )
      )
      or exists (
        select 1
        from public.trainees as trainee
        where trainee.id::text = (storage.foldername(name))[1]
          and trainee.owner_id = (select private.current_business_owner_id())
      )
    )
  );

-- Session payments are not subscription rows: they no longer stop the
-- current month's expected row from being created. Otherwise unchanged.
create or replace function public.ensure_monthly_payments(p_billing_month date)
returns setof public.trainee_monthly_payments
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
  v_current_month date := date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  if p_billing_month = v_current_month then
    insert into public.trainee_monthly_payments (
      owner_id, trainee_id, billing_month, trainee_name, package_name,
      amount, payment_method, payment_status, paid_at, source
    )
    select
      trainee.owner_id, trainee.id, p_billing_month, trainee.full_name, trainee.package_name,
      coalesce(trainee.package_price, 0), trainee.payment_method, 'unpaid', null, 'monthly'
    from public.trainees as trainee
    where trainee.owner_id = v_owner_id
      and trainee.status = 'פעיל'
      and not exists (
        select 1
        from public.trainee_monthly_payments as payment
        where payment.trainee_id = trainee.id
          and payment.billing_month = p_billing_month
          and payment.source in ('monthly', 'manual')
      )
    on conflict do nothing;
  end if;

  return query
    select payment.*
    from public.trainee_monthly_payments as payment
    where payment.owner_id = v_owner_id
      and payment.billing_month = p_billing_month
    order by payment.trainee_name;
end;
$$;

-- Trainee: create a request. p_request_id is chosen by the app before the
-- upload, so a retry of the same submit returns the same request.
create or replace function private.create_my_session_request(
  p_request_id uuid,
  p_requested_date date,
  p_requested_start_time time,
  p_payment_proof_path text,
  p_trainee_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainee public.trainees%rowtype;
  v_existing public.session_requests%rowtype;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is distinct from 'trainee' then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  select trainee.*
  into v_trainee
  from public.trainees as trainee
  where trainee.id = (select private.current_trainee_id());

  if not found then
    raise exception using errcode = '42501', message = 'Trainee account is not linked';
  end if;

  -- One request at a time per trainee, so the pending limit cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('session_request:' || v_trainee.id::text, 0));

  select request.*
  into v_existing
  from public.session_requests as request
  where request.id = p_request_id;

  if found then
    if v_existing.trainee_id = v_trainee.id
      and v_existing.payment_proof_path = p_payment_proof_path then
      return v_existing.id;
    end if;
    raise exception using errcode = 'P0001', message = 'Request id already used';
  end if;

  if v_trainee.training_type is distinct from 'אישי' then
    raise exception using errcode = 'P0001', message = 'Session requests are for in-person trainees';
  end if;

  if v_trainee.status not in ('פעיל', 'דורש מעקב') then
    raise exception using errcode = 'P0001', message = 'Trainee is not active';
  end if;

  if p_requested_date is null or p_requested_start_time is null
    or (p_requested_date + p_requested_start_time) <= (now() at time zone 'Asia/Jerusalem') then
    raise exception using errcode = 'P0001', message = 'Requested time must be in the future';
  end if;

  if p_requested_date > v_today + 60 then
    raise exception using errcode = 'P0001', message = 'Requested date is more than 60 days ahead';
  end if;

  if (
    select count(*)
    from public.session_requests as request
    where request.trainee_id = v_trainee.id
      and request.status = 'pending'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'Too many pending requests';
  end if;

  if p_payment_proof_path is null
    or split_part(p_payment_proof_path, '/', 1) <> v_trainee.id::text
    or split_part(p_payment_proof_path, '/', 2) <> p_request_id::text
    or not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'payment-proofs'
        and object.name = p_payment_proof_path
    ) then
    raise exception using errcode = 'P0001', message = 'Payment proof is required';
  end if;

  insert into public.session_requests (
    id, owner_id, trainee_id, requested_date, requested_start_time,
    trainee_note, payment_proof_path
  ) values (
    p_request_id, v_trainee.owner_id, v_trainee.id, p_requested_date, p_requested_start_time,
    nullif(btrim(p_trainee_note), ''), p_payment_proof_path
  );

  return p_request_id;
end;
$$;

-- Trainee: withdraw an own pending request. Repeating it changes nothing.
create or replace function private.cancel_my_session_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is distinct from 'trainee' then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  select request.status
  into v_status
  from public.session_requests as request
  where request.id = p_request_id
    and request.trainee_id = (select private.current_trainee_id())
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  if v_status = 'cancelled' then
    return;
  end if;

  if v_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'Request is no longer pending';
  end if;

  update public.session_requests
  set status = 'cancelled', decided_at = now(), decided_by = (select auth.uid())
  where id = p_request_id;
end;
$$;

-- Admin: approve. Creates the session and, when asked, one paid ledger row,
-- in the same transaction. A repeated approval returns the first result.
create or replace function private.approve_session_request(
  p_request_id uuid,
  p_location text,
  p_duration_minutes integer,
  p_record_payment boolean,
  p_amount numeric,
  p_payment_method text,
  p_paid_at date,
  p_decision_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_request public.session_requests%rowtype;
  v_trainee public.trainees%rowtype;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_session_id uuid;
  v_payment_id uuid;
  v_paid_at date;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is distinct from 'admin' then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  v_owner_id := (select private.current_business_owner_id());
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  select request.*
  into v_request
  from public.session_requests as request
  where request.id = p_request_id
    and request.owner_id = v_owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  if v_request.status = 'approved' then
    return jsonb_build_object(
      'already_approved', true,
      'session_id', v_request.scheduled_session_id,
      'payment_id', v_request.payment_id
    );
  end if;

  if v_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'Request is no longer pending';
  end if;

  select trainee.*
  into v_trainee
  from public.trainees as trainee
  where trainee.id = v_request.trainee_id;

  if v_trainee.status not in ('פעיל', 'דורש מעקב') then
    raise exception using errcode = 'P0001', message = 'Trainee is not active';
  end if;

  if (v_request.requested_date + v_request.requested_start_time) <= (now() at time zone 'Asia/Jerusalem') then
    raise exception using errcode = 'P0001', message = 'Requested time has passed';
  end if;

  if p_location is null or char_length(btrim(p_location)) = 0 then
    raise exception using errcode = 'P0001', message = 'Location is required';
  end if;

  if p_duration_minutes is null or p_duration_minutes not between 15 and 240 then
    raise exception using errcode = 'P0001', message = 'Invalid duration';
  end if;

  if coalesce(p_record_payment, false) then
    v_paid_at := coalesce(p_paid_at, v_today);

    if p_amount is null or p_amount < 0 then
      raise exception using errcode = 'P0001', message = 'Invalid payment amount';
    end if;
    if p_payment_method is null or char_length(btrim(p_payment_method)) = 0 then
      raise exception using errcode = 'P0001', message = 'Payment method is required';
    end if;
    if v_paid_at > v_today then
      raise exception using errcode = 'P0001', message = 'Paid date cannot be in the future';
    end if;
  end if;

  -- Same rule as the schedule form: no overlap with a non-cancelled session
  -- of the business on that date.
  if exists (
    select 1
    from public.training_sessions as session
    where session.owner_id = v_owner_id
      and session.session_date = v_request.requested_date
      and session.status <> 'בוטל'
      and extract(epoch from session.start_time) / 60
          < extract(epoch from v_request.requested_start_time) / 60 + p_duration_minutes
      and extract(epoch from session.start_time) / 60 + session.duration_minutes
          > extract(epoch from v_request.requested_start_time) / 60
  ) then
    raise exception using errcode = '23P01', message = 'Session conflict';
  end if;

  insert into public.training_sessions (
    owner_id, trainee_id, session_date, start_time, duration_minutes,
    training_type, location, status, notes
  ) values (
    v_owner_id, v_request.trainee_id, v_request.requested_date, v_request.requested_start_time,
    p_duration_minutes, 'אישי', btrim(p_location), 'מתוכנן', 'נקבע מבקשת מתאמן'
  )
  returning id into v_session_id;

  if coalesce(p_record_payment, false) then
    insert into public.trainee_monthly_payments (
      owner_id, trainee_id, billing_month, trainee_name, package_name,
      amount, payment_method, payment_status, paid_at, source
    ) values (
      v_owner_id, v_request.trainee_id, date_trunc('month', v_paid_at)::date, v_trainee.full_name,
      'אימון בודד', p_amount, btrim(p_payment_method), 'paid', v_paid_at, 'session_request'
    )
    returning id into v_payment_id;
  end if;

  update public.session_requests
  set status = 'approved',
      decided_at = now(),
      decided_by = (select auth.uid()),
      decision_note = nullif(btrim(p_decision_note), ''),
      scheduled_session_id = v_session_id,
      payment_id = v_payment_id
  where id = p_request_id;

  return jsonb_build_object(
    'already_approved', false,
    'session_id', v_session_id,
    'payment_id', v_payment_id
  );
end;
$$;

-- Admin: reject a pending request. No session and no payment are created.
create or replace function private.reject_session_request(p_request_id uuid, p_decision_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_status text;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is distinct from 'admin' then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  v_owner_id := (select private.current_business_owner_id());
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  select request.status
  into v_status
  from public.session_requests as request
  where request.id = p_request_id
    and request.owner_id = v_owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Request not found';
  end if;

  if v_status = 'rejected' then
    return;
  end if;

  if v_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'Request is no longer pending';
  end if;

  update public.session_requests
  set status = 'rejected',
      decided_at = now(),
      decided_by = (select auth.uid()),
      decision_note = nullif(btrim(p_decision_note), '')
  where id = p_request_id;
end;
$$;

revoke all on function private.create_my_session_request(uuid, date, time, text, text) from public, anon;
revoke all on function private.cancel_my_session_request(uuid) from public, anon;
revoke all on function private.approve_session_request(uuid, text, integer, boolean, numeric, text, date, text) from public, anon;
revoke all on function private.reject_session_request(uuid, text) from public, anon;
grant execute on function private.create_my_session_request(uuid, date, time, text, text) to authenticated;
grant execute on function private.cancel_my_session_request(uuid) to authenticated;
grant execute on function private.approve_session_request(uuid, text, integer, boolean, numeric, text, date, text) to authenticated;
grant execute on function private.reject_session_request(uuid, text) to authenticated;

create or replace function public.create_my_session_request(
  p_request_id uuid,
  p_requested_date date,
  p_requested_start_time time,
  p_payment_proof_path text,
  p_trainee_note text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_my_session_request(
    p_request_id, p_requested_date, p_requested_start_time, p_payment_proof_path, p_trainee_note
  );
$$;

create or replace function public.cancel_my_session_request(p_request_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.cancel_my_session_request(p_request_id);
$$;

create or replace function public.approve_session_request(
  p_request_id uuid,
  p_location text,
  p_duration_minutes integer default 60,
  p_record_payment boolean default true,
  p_amount numeric default null,
  p_payment_method text default null,
  p_paid_at date default null,
  p_decision_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.approve_session_request(
    p_request_id, p_location, p_duration_minutes, p_record_payment,
    p_amount, p_payment_method, p_paid_at, p_decision_note
  );
$$;

create or replace function public.reject_session_request(p_request_id uuid, p_decision_note text default null)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.reject_session_request(p_request_id, p_decision_note);
$$;

revoke all on function public.create_my_session_request(uuid, date, time, text, text) from public, anon;
revoke all on function public.cancel_my_session_request(uuid) from public, anon;
revoke all on function public.approve_session_request(uuid, text, integer, boolean, numeric, text, date, text) from public, anon;
revoke all on function public.reject_session_request(uuid, text) from public, anon;
grant execute on function public.create_my_session_request(uuid, date, time, text, text) to authenticated;
grant execute on function public.cancel_my_session_request(uuid) to authenticated;
grant execute on function public.approve_session_request(uuid, text, integer, boolean, numeric, text, date, text) to authenticated;
grant execute on function public.reject_session_request(uuid, text) to authenticated;

commit;
