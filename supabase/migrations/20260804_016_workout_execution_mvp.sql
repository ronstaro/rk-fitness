begin;

-- A completed workout must keep the program as it looked when the trainee
-- started it. These three tables therefore store a snapshot instead of relying
-- on mutable program rows for historical reporting.
create table public.workout_logs (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles(id) on delete cascade,
  trainee_id            uuid not null,
  source_program_id     uuid,
  source_program_day_id uuid,
  program_name          text not null,
  program_goal          text,
  day_name              text not null,
  day_order             integer not null,
  status                text not null default 'in_progress',
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint workout_logs_id_owner_id_key unique (id, owner_id),
  constraint workout_logs_trainee_owner_fk
    foreign key (trainee_id, owner_id)
    references public.trainees(id, owner_id)
    on delete cascade,
  constraint workout_logs_program_name_check check (char_length(btrim(program_name)) > 0),
  constraint workout_logs_day_name_check check (char_length(btrim(day_name)) > 0),
  constraint workout_logs_day_order_check check (day_order > 0),
  constraint workout_logs_status_check check (status in ('in_progress', 'completed')),
  constraint workout_logs_completion_check check (
    (status = 'in_progress' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create table public.workout_log_exercises (
  id                         uuid primary key default gen_random_uuid(),
  owner_id                   uuid not null references public.profiles(id) on delete cascade,
  workout_log_id             uuid not null,
  source_program_exercise_id uuid,
  exercise_order             integer not null,
  exercise_name              text not null,
  prescribed_sets            integer not null,
  prescribed_reps            text not null,
  target_rir                 numeric,
  rest_seconds               integer,
  trainer_notes              text,
  trainee_notes              text,
  is_completed               boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint workout_log_exercises_id_owner_id_key unique (id, owner_id),
  constraint workout_log_exercises_log_owner_fk
    foreign key (workout_log_id, owner_id)
    references public.workout_logs(id, owner_id)
    on delete cascade,
  constraint workout_log_exercises_name_check check (char_length(btrim(exercise_name)) > 0),
  constraint workout_log_exercises_order_check check (exercise_order > 0),
  constraint workout_log_exercises_sets_check check (prescribed_sets > 0),
  constraint workout_log_exercises_reps_check check (char_length(btrim(prescribed_reps)) > 0),
  constraint workout_log_exercises_rir_check
    check (target_rir is null or (target_rir >= 0 and target_rir <= 10)),
  constraint workout_log_exercises_rest_check
    check (rest_seconds is null or rest_seconds >= 0)
);

create table public.workout_log_sets (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references public.profiles(id) on delete cascade,
  workout_log_exercise_id uuid not null,
  set_order               integer not null,
  weight_kg               numeric(7,2),
  completed_reps          integer,
  rir                     numeric(3,1),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint workout_log_sets_exercise_owner_fk
    foreign key (workout_log_exercise_id, owner_id)
    references public.workout_log_exercises(id, owner_id)
    on delete cascade,
  constraint workout_log_sets_exercise_order_key
    unique (workout_log_exercise_id, set_order),
  constraint workout_log_sets_order_check check (set_order > 0),
  constraint workout_log_sets_weight_check
    check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 2000)),
  constraint workout_log_sets_reps_check
    check (completed_reps is null or (completed_reps >= 0 and completed_reps <= 1000)),
  constraint workout_log_sets_rir_check
    check (rir is null or (rir >= 0 and rir <= 10))
);

create unique index workout_logs_one_open_per_trainee
  on public.workout_logs (trainee_id)
  where status = 'in_progress';
create index workout_logs_owner_started_idx
  on public.workout_logs (owner_id, started_at desc);
create index workout_logs_trainee_started_idx
  on public.workout_logs (trainee_id, started_at desc);
create index workout_log_exercises_log_order_idx
  on public.workout_log_exercises (workout_log_id, exercise_order);
create index workout_log_exercises_owner_idx
  on public.workout_log_exercises (owner_id);
create index workout_log_sets_exercise_order_idx
  on public.workout_log_sets (workout_log_exercise_id, set_order);
create index workout_log_sets_owner_idx
  on public.workout_log_sets (owner_id);

create trigger workout_logs_updated_at
  before update on public.workout_logs
  for each row execute function public.set_updated_at();
create trigger workout_log_exercises_updated_at
  before update on public.workout_log_exercises
  for each row execute function public.set_updated_at();
create trigger workout_log_sets_updated_at
  before update on public.workout_log_sets
  for each row execute function public.set_updated_at();

alter table public.workout_logs enable row level security;
alter table public.workout_log_exercises enable row level security;
alter table public.workout_log_sets enable row level security;

create policy "workout_logs: business admin read"
  on public.workout_logs for select
  to authenticated
  using (owner_id = (select private.current_business_owner_id()));

create policy "workout_logs: trainee read own"
  on public.workout_logs for select
  to authenticated
  using (trainee_id = (select private.current_trainee_id()));

create policy "workout_log_exercises: business admin read"
  on public.workout_log_exercises for select
  to authenticated
  using (owner_id = (select private.current_business_owner_id()));

create policy "workout_log_exercises: trainee read own"
  on public.workout_log_exercises for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_logs as workout
      where workout.id = workout_log_exercises.workout_log_id
        and workout.trainee_id = (select private.current_trainee_id())
    )
  );

create policy "workout_log_exercises: trainee update open"
  on public.workout_log_exercises for update
  to authenticated
  using (
    exists (
      select 1
      from public.workout_logs as workout
      where workout.id = workout_log_exercises.workout_log_id
        and workout.trainee_id = (select private.current_trainee_id())
        and workout.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1
      from public.workout_logs as workout
      where workout.id = workout_log_exercises.workout_log_id
        and workout.trainee_id = (select private.current_trainee_id())
        and workout.status = 'in_progress'
    )
  );

create policy "workout_log_sets: business admin read"
  on public.workout_log_sets for select
  to authenticated
  using (owner_id = (select private.current_business_owner_id()));

create policy "workout_log_sets: trainee read own"
  on public.workout_log_sets for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_log_exercises as exercise
      join public.workout_logs as workout on workout.id = exercise.workout_log_id
      where exercise.id = workout_log_sets.workout_log_exercise_id
        and workout.trainee_id = (select private.current_trainee_id())
    )
  );

create policy "workout_log_sets: trainee update open"
  on public.workout_log_sets for update
  to authenticated
  using (
    exists (
      select 1
      from public.workout_log_exercises as exercise
      join public.workout_logs as workout on workout.id = exercise.workout_log_id
      where exercise.id = workout_log_sets.workout_log_exercise_id
        and workout.trainee_id = (select private.current_trainee_id())
        and workout.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1
      from public.workout_log_exercises as exercise
      join public.workout_logs as workout on workout.id = exercise.workout_log_id
      where exercise.id = workout_log_sets.workout_log_exercise_id
        and workout.trainee_id = (select private.current_trainee_id())
        and workout.status = 'in_progress'
    )
  );

revoke all on public.workout_logs from anon, authenticated;
revoke all on public.workout_log_exercises from anon, authenticated;
revoke all on public.workout_log_sets from anon, authenticated;
grant select on public.workout_logs to authenticated;
grant select on public.workout_log_exercises to authenticated;
grant select on public.workout_log_sets to authenticated;
grant update (trainee_notes, is_completed) on public.workout_log_exercises to authenticated;
grant update (weight_kg, completed_reps, rir) on public.workout_log_sets to authenticated;

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

  -- Serialize double-clicks and concurrent tabs before checking the partial
  -- unique index, so the second call safely returns the already-open workout.
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
    insert into public.workout_log_exercises (
      owner_id, workout_log_id, source_program_exercise_id, exercise_order,
      exercise_name, prescribed_sets, prescribed_reps, target_rir,
      rest_seconds, trainer_notes
    ) values (
      v_program.owner_id, v_workout_id, v_exercise.id, v_exercise.exercise_order,
      v_exercise.name, v_exercise.sets, v_exercise.reps, v_exercise.target_rir,
      v_exercise.rest_seconds, v_exercise.notes
    )
    returning id into v_exercise_log_id;

    insert into public.workout_log_sets (
      owner_id, workout_log_exercise_id, set_order
    )
    select v_program.owner_id, v_exercise_log_id, set_number
    from generate_series(1, v_exercise.sets) as set_number;
  end loop;

  return v_workout_id;
end;
$$;

create or replace function private.finish_current_trainee_workout(p_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainee_id uuid;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is null
    or (select private.auth_user_role()) not in ('admin', 'trainee') then
    raise exception 'Not authorized';
  end if;

  v_trainee_id := (select private.current_trainee_id());

  update public.workout_logs
  set status = 'completed', completed_at = now()
  where id = p_workout_id
    and trainee_id = v_trainee_id
    and status = 'in_progress';

  if not found then
    raise exception 'Open workout not found';
  end if;
end;
$$;

revoke all on function private.start_current_trainee_workout(uuid) from public, anon;
revoke all on function private.finish_current_trainee_workout(uuid) from public, anon;
grant execute on function private.start_current_trainee_workout(uuid) to authenticated;
grant execute on function private.finish_current_trainee_workout(uuid) to authenticated;

create or replace function public.start_my_workout(p_program_day_id uuid)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.start_current_trainee_workout(p_program_day_id);
$$;

create or replace function public.finish_my_workout(p_workout_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.finish_current_trainee_workout(p_workout_id);
$$;

revoke all on function public.start_my_workout(uuid) from public, anon;
revoke all on function public.finish_my_workout(uuid) from public, anon;
grant execute on function public.start_my_workout(uuid) to authenticated;
grant execute on function public.finish_my_workout(uuid) to authenticated;

commit;
