begin;

-- Resolve the trainee row linked to the current authenticated user without
-- exposing the base trainees table to trainee accounts.
create or replace function private.current_trainee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select trainee.id
  from public.trainees as trainee
  where trainee.user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function private.current_trainee_id() from public, anon;
grant execute on function private.current_trainee_id() to authenticated;

-- This is the only trainee-facing profile endpoint. Its return type omits
-- owner/user identifiers, internal notes, status, package and payment fields.
create or replace function public.get_my_trainee_profile()
returns table (
  id uuid,
  full_name text,
  phone text,
  birth_date date,
  start_date date,
  training_type text,
  main_goal text,
  success_metric text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    trainee.id,
    trainee.full_name,
    trainee.phone,
    trainee.birth_date,
    trainee.start_date,
    trainee.training_type,
    trainee.main_goal,
    trainee.success_metric
  from public.trainees as trainee
  where (select auth.uid()) is not null
    and trainee.id = private.current_trainee_id();
$$;

revoke all on function public.get_my_trainee_profile() from public, anon;
grant execute on function public.get_my_trainee_profile() to authenticated;

-- Admin access remains on the business-admin policy. Trainees no longer read
-- the base row directly, so sensitive columns cannot be requested via REST.
drop policy if exists "trainees: trainee read own" on public.trainees;

drop policy if exists "training_sessions: trainee read own" on public.training_sessions;
create policy "training_sessions: trainee read own"
  on public.training_sessions for select
  to authenticated
  using (
    (select private.auth_user_role()) = 'trainee'
    and trainee_id = (select private.current_trainee_id())
  );

drop policy if exists "workout_programs: trainee read own active" on public.workout_programs;
create policy "workout_programs: trainee read own active"
  on public.workout_programs for select
  to authenticated
  using (
    (select private.auth_user_role()) = 'trainee'
    and status = 'active'
    and trainee_id = (select private.current_trainee_id())
  );

drop policy if exists "program_days: trainee read own active" on public.program_days;
create policy "program_days: trainee read own active"
  on public.program_days for select
  to authenticated
  using (
    (select private.auth_user_role()) = 'trainee'
    and exists (
      select 1
      from public.workout_programs as program
      where program.id = program_days.program_id
        and program.status = 'active'
        and program.trainee_id = (select private.current_trainee_id())
    )
  );

drop policy if exists "program_exercises: trainee read own active" on public.program_exercises;
create policy "program_exercises: trainee read own active"
  on public.program_exercises for select
  to authenticated
  using (
    (select private.auth_user_role()) = 'trainee'
    and exists (
      select 1
      from public.program_days as program_day
      join public.workout_programs as program
        on program.id = program_day.program_id
      where program_day.id = program_exercises.program_day_id
        and program.status = 'active'
        and program.trainee_id = (select private.current_trainee_id())
    )
  );

commit;
