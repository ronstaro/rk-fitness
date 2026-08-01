-- R.K Fitness — per-trainee notes for a Sunday-to-Saturday training week.
create table public.trainee_weekly_goal_notes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  trainee_id uuid not null,
  week_start date not null,
  note       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainee_weekly_goal_notes_trainee_owner_fk
    foreign key (trainee_id, owner_id)
    references public.trainees(id, owner_id)
    on delete cascade,
  constraint trainee_weekly_goal_notes_week_start_check
    check (extract(dow from week_start) = 0),
  constraint trainee_weekly_goal_notes_note_check
    check (char_length(btrim(note)) between 1 and 500),
  constraint trainee_weekly_goal_notes_owner_trainee_week_key
    unique (owner_id, trainee_id, week_start)
);

create trigger trainee_weekly_goal_notes_updated_at
  before update on public.trainee_weekly_goal_notes
  for each row execute function public.set_updated_at();

create index trainee_weekly_goal_notes_owner_week_idx
  on public.trainee_weekly_goal_notes (owner_id, week_start);

alter table public.trainee_weekly_goal_notes enable row level security;

create policy "trainee_weekly_goal_notes: admin create"
  on public.trainee_weekly_goal_notes for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and public.auth_user_role() = 'admin');

create policy "trainee_weekly_goal_notes: admin read"
  on public.trainee_weekly_goal_notes for select
  to authenticated
  using (owner_id = (select auth.uid()) and public.auth_user_role() = 'admin');

create policy "trainee_weekly_goal_notes: admin update"
  on public.trainee_weekly_goal_notes for update
  to authenticated
  using (owner_id = (select auth.uid()) and public.auth_user_role() = 'admin')
  with check (owner_id = (select auth.uid()) and public.auth_user_role() = 'admin');

create policy "trainee_weekly_goal_notes: admin delete"
  on public.trainee_weekly_goal_notes for delete
  to authenticated
  using (owner_id = (select auth.uid()) and public.auth_user_role() = 'admin');

grant select, insert, update, delete on public.trainee_weekly_goal_notes to authenticated;
