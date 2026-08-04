begin;

-- Trainees may read only the active program linked to their own trainee row.
-- Existing business-admin policies remain unchanged and combine permissively.
create policy "workout_programs: trainee read own active"
  on public.workout_programs for select
  to authenticated
  using (
    (select private.auth_user_role()) = 'trainee'
    and status = 'active'
    and exists (
      select 1
      from public.trainees as trainee
      where trainee.id = workout_programs.trainee_id
        and trainee.user_id = (select auth.uid())
    )
  );

create policy "program_days: trainee read own active"
  on public.program_days for select
  to authenticated
  using (
    (select private.auth_user_role()) = 'trainee'
    and exists (
      select 1
      from public.workout_programs as program
      join public.trainees as trainee
        on trainee.id = program.trainee_id
      where program.id = program_days.program_id
        and program.status = 'active'
        and trainee.user_id = (select auth.uid())
    )
  );

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
      join public.trainees as trainee
        on trainee.id = program.trainee_id
      where program_day.id = program_exercises.program_day_id
        and program.status = 'active'
        and trainee.user_id = (select auth.uid())
    )
  );

commit;
