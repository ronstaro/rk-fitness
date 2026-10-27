-- 029: Superset / Triple set groups.
--
-- Consecutive exercises of one workout type that share an exercise_group_id
-- form one block (2 = superset, 3 = triple set). The type and the number of
-- rounds are not stored: the type is the member count and the rounds are the
-- members' own `sets`, so there is no second source of truth. NULL keeps an
-- exercise standalone, which is what every existing row gets.
--
-- workout_log_exercises gets the same column so a started workout keeps the
-- grouping it started with (016 snapshot design). The only change to
-- private.start_current_trainee_workout is copying that one column; the rest
-- of the body is the 018 version unchanged.
--
-- No policy or grant changes: both columns are covered by the existing RLS,
-- and trainees have no UPDATE grant on either column.

begin;

alter table public.program_exercises
  add column exercise_group_id uuid;

alter table public.workout_log_exercises
  add column exercise_group_id uuid;

create or replace function private.start_current_trainee_workout(p_program_day_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainee_id uuid;
  v_existing_id uuid;
  v_workout_id uuid;
  v_exercise_log_id uuid;
  v_previous_exercise_id uuid;
  v_program record;
  v_exercise record;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is null
    or (select private.auth_user_role()) not in ('admin', 'trainee') then
    raise exception 'Not authorized';
  end if;

  v_trainee_id := (select private.current_trainee_id());
  if v_trainee_id is null then
    raise exception 'Trainee account is not linked';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_trainee_id::text, 0));

  select workout.id
  into v_existing_id
  from public.workout_logs as workout
  where workout.trainee_id = v_trainee_id
    and workout.status = 'in_progress'
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select
    program.id as program_id,
    program.owner_id,
    program.trainee_id,
    program.name as program_name,
    program.goal as program_goal,
    program_day.id as program_day_id,
    program_day.name as day_name,
    program_day.day_order
  into v_program
  from public.program_days as program_day
  join public.workout_programs as program on program.id = program_day.program_id
  where program_day.id = p_program_day_id
    and program.trainee_id = v_trainee_id
    and program.status = 'active';

  if not found then
    raise exception 'Active workout day not found';
  end if;

  if not exists (
    select 1
    from public.program_exercises as exercise
    where exercise.program_day_id = v_program.program_day_id
  ) then
    raise exception 'Workout day has no exercises';
  end if;

  insert into public.workout_logs (
    owner_id, trainee_id, source_program_id, source_program_day_id,
    program_name, program_goal, day_name, day_order
  ) values (
    v_program.owner_id, v_program.trainee_id, v_program.program_id, v_program.program_day_id,
    v_program.program_name, v_program.program_goal, v_program.day_name, v_program.day_order
  )
  returning id into v_workout_id;

  for v_exercise in
    select *
    from public.program_exercises as exercise
    where exercise.program_day_id = v_program.program_day_id
    order by exercise.exercise_order
  loop
    v_previous_exercise_id := null;

    select previous_exercise.id
    into v_previous_exercise_id
    from public.workout_log_exercises as previous_exercise
    join public.workout_logs as previous_workout
      on previous_workout.id = previous_exercise.workout_log_id
    where previous_workout.trainee_id = v_trainee_id
      and previous_workout.status = 'completed'
      and (
        previous_exercise.source_program_exercise_id = v_exercise.id
        or lower(btrim(previous_exercise.exercise_name)) = lower(btrim(v_exercise.name))
      )
    order by
      (previous_exercise.source_program_exercise_id = v_exercise.id) desc,
      previous_workout.completed_at desc
    limit 1;

    insert into public.workout_log_exercises (
      owner_id, workout_log_id, source_program_exercise_id, exercise_order,
      exercise_name, prescribed_sets, prescribed_reps, target_weight_kg,
      target_rir, rest_seconds, trainer_notes, exercise_group_id
    ) values (
      v_program.owner_id, v_workout_id, v_exercise.id, v_exercise.exercise_order,
      v_exercise.name, v_exercise.sets, v_exercise.reps, v_exercise.target_weight_kg,
      v_exercise.target_rir, v_exercise.rest_seconds, v_exercise.notes,
      v_exercise.exercise_group_id
    )
    returning id into v_exercise_log_id;

    insert into public.workout_log_sets (
      owner_id,
      workout_log_exercise_id,
      set_order,
      weight_kg,
      completed_reps,
      rir,
      previous_weight_kg,
      previous_reps,
      previous_rir,
      is_completed
    )
    select
      v_program.owner_id,
      v_exercise_log_id,
      set_number,
      coalesce(previous_set.weight_kg, v_exercise.target_weight_kg),
      previous_set.completed_reps,
      coalesce(previous_set.rir, v_exercise.target_rir),
      previous_set.weight_kg,
      previous_set.completed_reps,
      previous_set.rir,
      false
    from generate_series(1, v_exercise.sets) as set_number
    left join public.workout_log_sets as previous_set
      on previous_set.workout_log_exercise_id = v_previous_exercise_id
      and previous_set.set_order = set_number
      and previous_set.is_completed;
  end loop;

  return v_workout_id;
end;
$$;

revoke all on function private.start_current_trainee_workout(uuid) from public, anon;
grant execute on function private.start_current_trainee_workout(uuid) to authenticated;

commit;
