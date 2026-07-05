-- ============================================================
-- R.K Fitness — initial schema
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'admin',
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'trainee'))
);

-- ------------------------------------------------------------
-- leads
-- ------------------------------------------------------------
create table leads (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  full_name       text not null,
  phone           text,
  source          text,
  custom_source   text,
  status          text not null,
  follow_up_date  date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint leads_status_check check (
    status in ('חדש', 'נוצר קשר', 'מעקב', 'הומר למתאמן', 'לא רלוונטי')
  )
);

-- ------------------------------------------------------------
-- trainees
-- ------------------------------------------------------------
create table trainees (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles(id) on delete cascade,
  user_id          uuid unique references profiles(id) on delete set null,
  full_name        text not null,
  phone            text,
  birth_date       date,
  start_date       date,
  training_type    text,
  status           text not null,
  main_goal        text,
  success_metric   text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint trainees_training_type_check check (
    training_type in ('אישי', 'אונליין', 'קבוצתי')
  ),
  constraint trainees_status_check check (
    status in ('פעיל', 'בהקפאה', 'דורש מעקב', 'הסתיים')
  )
);

-- ------------------------------------------------------------
-- training_sessions
-- ------------------------------------------------------------
create table training_sessions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles(id) on delete cascade,
  trainee_id       uuid not null references trainees(id) on delete cascade,
  session_date     date not null,
  start_time       time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  training_type    text not null,
  location         text not null,
  status           text not null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint training_sessions_training_type_check check (
    training_type in ('אישי', 'אונליין', 'קבוצתי')
  ),
  constraint training_sessions_status_check check (
    status in ('מתוכנן', 'הושלם', 'בוטל', 'דורש תיאום')
  )
);

-- ------------------------------------------------------------
-- updated_at trigger function (shared)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

create trigger leads_updated_at
  before update on leads
  for each row execute function public.set_updated_at();

create trigger trainees_updated_at
  before update on trainees
  for each row execute function public.set_updated_at();

create trigger training_sessions_updated_at
  before update on training_sessions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- indexes
-- ------------------------------------------------------------
create index on leads (owner_id);
create index on leads (follow_up_date);
create index on trainees (owner_id);
create index on trainees (status);
create index on training_sessions (owner_id);
create index on training_sessions (trainee_id);
create index on training_sessions (session_date);
create index on training_sessions (session_date, start_time);

-- ------------------------------------------------------------
-- row level security
-- ------------------------------------------------------------
alter table profiles         enable row level security;
alter table leads            enable row level security;
alter table trainees         enable row level security;
alter table training_sessions enable row level security;

-- Helper: returns the role of the currently authenticated user.
-- security definer so it bypasses RLS on profiles without recursion.
create or replace function public.auth_user_role()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

-- -- profiles --

-- All authenticated users can read their own profile
create policy "profiles: read own"
  on profiles for select
  to authenticated
  using (id = auth.uid());

-- Only admins can update their own profile
create policy "profiles: admin update own"
  on profiles for update
  to authenticated
  using  (id = auth.uid() and public.auth_user_role() = 'admin')
  with check (id = auth.uid());

-- -- leads --

create policy "leads: admin create"
  on leads for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "leads: admin read"
  on leads for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "leads: admin update"
  on leads for update
  to authenticated
  using  (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid());

create policy "leads: admin delete"
  on leads for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

-- -- trainees --

create policy "trainees: admin create"
  on trainees for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "trainees: admin read"
  on trainees for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "trainees: admin update"
  on trainees for update
  to authenticated
  using  (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid());

create policy "trainees: admin delete"
  on trainees for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

-- Trainees can read only their own linked trainee record
create policy "trainees: trainee read own"
  on trainees for select
  to authenticated
  using (user_id = auth.uid() and public.auth_user_role() = 'trainee');

-- -- training_sessions --

create policy "training_sessions: admin create"
  on training_sessions for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "training_sessions: admin read"
  on training_sessions for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "training_sessions: admin update"
  on training_sessions for update
  to authenticated
  using  (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid());

create policy "training_sessions: admin delete"
  on training_sessions for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

-- Trainees can read sessions linked to their own trainee record
create policy "training_sessions: trainee read own"
  on training_sessions for select
  to authenticated
  using (
    public.auth_user_role() = 'trainee'
    and trainee_id in (select id from trainees where user_id = auth.uid())
  );
