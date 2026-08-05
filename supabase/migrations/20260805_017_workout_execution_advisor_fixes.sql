begin;

-- Cover the composite foreign keys used by workout execution joins and
-- cascading deletes. The single-column indexes from migration 016 remain
-- useful for their ordering/filtering use cases.
create index workout_logs_trainee_owner_idx
  on public.workout_logs (trainee_id, owner_id);
create index workout_log_exercises_log_owner_idx
  on public.workout_log_exercises (workout_log_id, owner_id);
create index workout_log_sets_exercise_owner_idx
  on public.workout_log_sets (workout_log_exercise_id, owner_id);

-- Keep the same admin-or-trainee read access while avoiding multiple
-- permissive SELECT policies for the authenticated role.
drop policy if exists "workout_logs: business admin read" on public.workout_logs;
drop policy if exists "workout_logs: trainee read own" on public.workout_logs;
create policy "workout_logs: authorized read"
  on public.workout_logs for select
  to authenticated
  using (
    owner_id = (select private.current_business_owner_id())
    or trainee_id = (select private.current_trainee_id())
  );

drop policy if exists "workout_log_exercises: business admin read" on public.workout_log_exercises;
drop policy if exists "workout_log_exercises: trainee read own" on public.workout_log_exercises;
create policy "workout_log_exercises: authorized read"
  on public.workout_log_exercises for select
  to authenticated
  using (
    owner_id = (select private.current_business_owner_id())
    or exists (
      select 1
      from public.workout_logs as workout
      where workout.id = workout_log_exercises.workout_log_id
        and workout.trainee_id = (select private.current_trainee_id())
    )
  );

drop policy if exists "workout_log_sets: business admin read" on public.workout_log_sets;
drop policy if exists "workout_log_sets: trainee read own" on public.workout_log_sets;
create policy "workout_log_sets: authorized read"
  on public.workout_log_sets for select
  to authenticated
  using (
    owner_id = (select private.current_business_owner_id())
    or exists (
      select 1
      from public.workout_log_exercises as exercise
      join public.workout_logs as workout on workout.id = exercise.workout_log_id
      where exercise.id = workout_log_sets.workout_log_exercise_id
        and workout.trainee_id = (select private.current_trainee_id())
    )
  );

commit;
