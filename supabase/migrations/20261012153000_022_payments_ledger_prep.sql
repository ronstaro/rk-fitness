-- 022: Prepare trainee_monthly_payments to act as the single payments ledger.
--
-- Additive and backward compatible: the monthly UNIQUE constraint stays, so
-- the frontend currently in production keeps working. Nothing existing is
-- rewritten except that every current row is marked source = 'monthly'.
--
-- * source: where a row came from (the automatic monthly row, a payment Roni
--   added by hand, or later a session request).
-- * payment_status now defaults to 'unpaid': a row is paid only after a real
--   payment is recorded.
-- * One list of payment methods for payments and trainee profiles. 'Bit' stays
--   allowed because older trainee profiles and payment rows use it.
-- * ensure_monthly_payments creates the current month's expected rows on the
--   server instead of a client-side upsert.

alter table public.trainee_monthly_payments
  add column source text not null default 'monthly',
  add constraint trainee_monthly_payments_source_check
    check (source in ('monthly', 'manual', 'session_request')),
  add constraint trainee_monthly_payments_method_check
    check (
      payment_method is null
      or payment_method in ('העברה בנקאית', 'ביט', 'פייבוקס', 'אשראי', 'מזומן', 'אחר', 'Bit')
    );

alter table public.trainee_monthly_payments
  alter column payment_status set default 'unpaid';

alter table public.trainees
  drop constraint trainees_payment_method_check,
  add constraint trainees_payment_method_check
    check (
      payment_method is null
      or payment_method in ('העברה בנקאית', 'ביט', 'פייבוקס', 'אשראי', 'מזומן', 'אחר', 'Bit')
    );

-- Latest received payment per trainee, for the next expected payment date.
create index trainee_monthly_payments_trainee_paid_idx
  on public.trainee_monthly_payments (trainee_id, paid_at desc)
  where payment_status = 'paid' and paid_at is not null;

-- Creates the current month's expected (unpaid) row for every active trainee
-- that has no row of any kind in that month yet, including a removed one, and
-- returns the month's rows. Runs with the caller's rights, so RLS limits it to
-- the admin's own business. Any other month is only read, never filled.
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

revoke all on function public.ensure_monthly_payments(date) from public, anon;
grant execute on function public.ensure_monthly_payments(date) to authenticated;
