-- R.K Fitness — workout program list and planning fields

alter table public.workout_programs
  add column if not exists duration_weeks integer,
  add column if not exists sessions_per_week integer,
  add column if not exists is_template boolean not null default false;

alter table public.workout_programs
  add constraint workout_programs_duration_weeks_check
    check (duration_weeks is null or duration_weeks between 1 and 52),
  add constraint workout_programs_sessions_per_week_check
    check (sessions_per_week is null or sessions_per_week between 1 and 14);
