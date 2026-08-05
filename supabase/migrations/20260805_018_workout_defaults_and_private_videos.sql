begin;

alter table public.program_exercises
  add column target_weight_kg numeric(7,2),
  add constraint program_exercises_target_weight_check
    check (target_weight_kg is null or (target_weight_kg >= 0 and target_weight_kg <= 2000));

alter table public.workout_log_exercises
  add column target_weight_kg numeric(7,2),
  add column video_path text,
  add column video_uploaded_at timestamptz,
  add constraint workout_log_exercises_target_weight_check
    check (target_weight_kg is null or (target_weight_kg >= 0 and target_weight_kg <= 2000));

alter table public.workout_log_sets
  add column previous_weight_kg numeric(7,2),
  add column previous_reps integer,
  add column previous_rir numeric(3,1),
  add column is_completed boolean not null default false,
  add constraint workout_log_sets_previous_weight_check
    check (previous_weight_kg is null or (previous_weight_kg >= 0 and previous_weight_kg <= 2000)),
  add constraint workout_log_sets_previous_reps_check
    check (previous_reps is null or (previous_reps >= 0 and previous_reps <= 1000)),
  add constraint workout_log_sets_previous_rir_check
    check (previous_rir is null or (previous_rir >= 0 and previous_rir <= 10));

-- Preserve useful history if completed workouts already exist before this
-- migration. New workouts explicitly confirm each set in the live UI.
update public.workout_log_sets as workout_set
set is_completed = true
from public.workout_log_exercises as exercise
join public.workout_logs as workout on workout.id = exercise.workout_log_id
where workout_set.workout_log_exercise_id = exercise.id
  and workout.status = 'completed'
  and (
    workout_set.weight_kg is not null
    or workout_set.completed_reps is not null
    or workout_set.rir is not null
  );

grant update (is_completed) on public.workout_log_sets to authenticated;
grant update (video_path, video_uploaded_at) on public.workout_log_exercises to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'workout-videos',
  'workout-videos',
  false,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
);

create policy "workout videos: authorized read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workout-videos'
    and exists (
      select 1
      from public.workout_log_exercises as exercise
      join public.workout_logs as workout on workout.id = exercise.workout_log_id
      where exercise.id::text = (storage.foldername(name))[2]
        and (
          workout.owner_id = (select private.current_business_owner_id())
          or workout.trainee_id = (select private.current_trainee_id())
        )
    )
  );

create policy "workout videos: trainee upload open exercise"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workout-videos'
    and (storage.foldername(name))[1] = (select private.current_trainee_id())::text
    and exists (
      select 1
      from public.workout_log_exercises as exercise
      join public.workout_logs as workout on workout.id = exercise.workout_log_id
      where exercise.id::text = (storage.foldername(name))[2]
        and workout.trainee_id = (select private.current_trainee_id())
        and workout.status = 'in_progress'
    )
  );

create policy "workout videos: trainee delete open exercise"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workout-videos'
    and (storage.foldername(name))[1] = (select private.current_trainee_id())::text
    and exists (
      select 1
      from public.workout_log_exercises as exercise
      join public.workout_logs as workout on workout.id = exercise.workout_log_id
      where exercise.id::text = (storage.foldername(name))[2]
        and workout.trainee_id = (select private.current_trainee_id())
        and workout.status = 'in_progress'
    )
  );

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
      target_rir, rest_seconds, trainer_notes
    ) values (
      v_program.owner_id, v_workout_id, v_exercise.id, v_exercise.exercise_order,
      v_exercise.name, v_exercise.sets, v_exercise.reps, v_exercise.target_weight_kg,
      v_exercise.target_rir, v_exercise.rest_seconds, v_exercise.notes
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
