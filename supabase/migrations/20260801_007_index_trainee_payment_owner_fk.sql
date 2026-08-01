-- Cover the composite trainee/owner foreign key while preserving
-- trainee_id as the leading column for trainee-based lookups.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop index if exists public.trainee_monthly_payments_trainee_idx;

create index trainee_monthly_payments_trainee_owner_idx
  on public.trainee_monthly_payments (trainee_id, owner_id);
