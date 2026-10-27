-- 027: online trainees may also request a one-off session.
--
-- Only change against 025: private.create_my_session_request now accepts
-- trainees whose training_type is 'אישי' or 'אונליין' (was 'אישי' only).
-- The trainee's own training_type is not changed; an approved request still
-- creates an 'אישי' training session. Every other rule is identical: trainee
-- role, linked trainee, active status, future time, 60 days ahead, 3 pending,
-- payment proof in the trainee's own folder, idempotent retry. Approval,
-- reject, cancel, RLS, storage policies and grants are untouched.
-- CREATE OR REPLACE keeps the same signature, owner and EXECUTE grants.

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

  if coalesce(v_trainee.training_type, '') not in ('אישי', 'אונליין') then
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

