-- ============================================================
-- R.K Fitness — admin workout programs
-- ============================================================

-- Composite ownership keys keep every relationship inside one admin's data.
-- This additive index lets the composite foreign key below verify ownership
-- without altering an existing table constraint.
create unique index if not exists trainees_id_owner_id_uidx
  on public.trainees (id, owner_id);

create table public.workout_programs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  trainee_id uuid not null,
  name       text not null,
  goal       text,
  status     text not null default 'draft',
  start_date date,
  end_date   date,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_programs_id_owner_id_key unique (id, owner_id),
  constraint workout_programs_trainee_owner_fk
    foreign key (trainee_id, owner_id)
    references public.trainees(id, owner_id)
    on delete cascade,
  constraint workout_programs_name_check check (char_length(btrim(name)) > 0),
  constraint workout_programs_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint workout_programs_dates_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.program_days (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null,
  name       text not null,
  day_order  integer not null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_days_id_owner_id_key unique (id, owner_id),
  constraint program_days_program_owner_fk
    foreign key (program_id, owner_id)
    references public.workout_programs(id, owner_id)
    on delete cascade,
  constraint program_days_name_check check (char_length(btrim(name)) > 0),
  constraint program_days_order_check check (day_order > 0)
);

create table public.program_exercises (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  program_day_id uuid not null,
  name           text not null,
  exercise_order integer not null,
  sets           integer not null,
  reps           text not null,
  target_rir     numeric,
  rest_seconds   integer,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint program_exercises_day_owner_fk
    foreign key (program_day_id, owner_id)
    references public.program_days(id, owner_id)
    on delete cascade,
  constraint program_exercises_name_check check (char_length(btrim(name)) > 0),
  constraint program_exercises_order_check check (exercise_order > 0),
  constraint program_exercises_sets_check check (sets > 0),
  constraint program_exercises_reps_check check (char_length(btrim(reps)) > 0),
  constraint program_exercises_rir_check
    check (target_rir is null or (target_rir >= 0 and target_rir <= 10)),
  constraint program_exercises_rest_check
    check (rest_seconds is null or rest_seconds >= 0)
);

create trigger workout_programs_updated_at
  before update on public.workout_programs
  for each row execute function public.set_updated_at();

create trigger program_days_updated_at
  before update on public.program_days
  for each row execute function public.set_updated_at();

create trigger program_exercises_updated_at
  before update on public.program_exercises
  for each row execute function public.set_updated_at();

create index workout_programs_owner_idx
  on public.workout_programs (owner_id);
create index workout_programs_trainee_idx
  on public.workout_programs (trainee_id);
create unique index workout_programs_one_active_per_trainee
  on public.workout_programs (trainee_id)
  where status = 'active';

create index program_days_owner_idx
  on public.program_days (owner_id);
create index program_days_program_order_idx
  on public.program_days (program_id, day_order);

create index program_exercises_owner_idx
  on public.program_exercises (owner_id);
create index program_exercises_day_order_idx
  on public.program_exercises (program_day_id, exercise_order);

alter table public.workout_programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;

create policy "workout_programs: admin create"
  on public.workout_programs for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "workout_programs: admin read"
  on public.workout_programs for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "workout_programs: admin update"
  on public.workout_programs for update
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "workout_programs: admin delete"
  on public.workout_programs for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_days: admin create"
  on public.program_days for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_days: admin read"
  on public.program_days for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_days: admin update"
  on public.program_days for update
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_days: admin delete"
  on public.program_days for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_exercises: admin create"
  on public.program_exercises for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_exercises: admin read"
  on public.program_exercises for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_exercises: admin update"
  on public.program_exercises for update
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "program_exercises: admin delete"
  on public.program_exercises for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

grant select, insert, update, delete on public.workout_programs to authenticated;
grant select, insert, update, delete on public.program_days to authenticated;
grant select, insert, update, delete on public.program_exercises to authenticated;

create or replace function public.activate_workout_program(p_program_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_program public.workout_programs;
begin
  if public.auth_user_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  select *
  into v_program
  from public.workout_programs
  where id = p_program_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Program not found';
  end if;

  update public.workout_programs
  set status = 'archived'
  where owner_id = auth.uid()
    and trainee_id = v_program.trainee_id
    and status = 'active'
    and id <> p_program_id;

  update public.workout_programs
  set status = 'active'
  where id = p_program_id
    and owner_id = auth.uid();
end;
$$;

revoke execute on function public.activate_workout_program(uuid) from public;
revoke execute on function public.activate_workout_program(uuid) from anon;
grant execute on function public.activate_workout_program(uuid) to authenticated;
