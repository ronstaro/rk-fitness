-- Preserve monthly finance history when a trainee is deleted.
-- Only trainee_id is cleared; owner_id remains for RLS ownership.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.trainee_monthly_payments
  alter column trainee_id drop not null;

alter table public.trainee_monthly_payments
  drop constraint trainee_monthly_payments_trainee_owner_fk;

alter table public.trainee_monthly_payments
  add constraint trainee_monthly_payments_trainee_owner_fk
    foreign key (trainee_id, owner_id)
    references public.trainees(id, owner_id)
    on delete set null (trainee_id);
