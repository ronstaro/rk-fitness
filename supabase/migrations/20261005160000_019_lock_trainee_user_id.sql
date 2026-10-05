begin;

-- trainees.user_id links an auth account to a trainee row. It must only be
-- written by the secure invitation functions (security definer), never by
-- ordinary admin CRUD through the API. Table-level INSERT/UPDATE is replaced
-- with column-level grants that omit user_id (and owner_id/id on update).
-- Revoking the table privilege also clears any existing column privileges.
revoke insert, update on table public.trainees from public, anon, authenticated;

-- Columns written by traineesService.createTrainee and by the security
-- invoker function public.convert_lead_to_trainee.
grant insert (
  owner_id,
  full_name,
  phone,
  birth_date,
  start_date,
  training_type,
  status,
  main_goal,
  success_metric,
  notes,
  package_name,
  package_price,
  payment_method,
  payment_status,
  next_payment_date
) on table public.trainees to authenticated;

-- Columns written by traineesService.updateTrainee/updateTraineeStatus.
-- updated_at is maintained by the trainees_updated_at trigger.
grant update (
  full_name,
  phone,
  birth_date,
  start_date,
  training_type,
  status,
  main_goal,
  success_metric,
  notes,
  package_name,
  package_price,
  payment_method,
  payment_status,
  next_payment_date
) on table public.trainees to authenticated;

-- Every signup is inserted as 'trainee' by handle_new_user(). Make the column
-- default match so no future insert path can fall back to 'admin'.
alter table public.profiles
  alter column role set default 'trainee';

commit;
