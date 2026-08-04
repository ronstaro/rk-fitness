begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.business_admins (
  member_id uuid primary key references public.profiles(id) on delete cascade,
  business_owner_id uuid not null references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.business_admins is
  'Maps an authenticated admin to the stable owner_id used by one business.';

create index business_admins_owner_active_idx
  on public.business_admins (business_owner_id, is_active);

alter table public.business_admins enable row level security;

grant select on public.business_admins to authenticated;
revoke insert, update, delete on public.business_admins from anon, authenticated;

create policy "business_admins: read own membership"
  on public.business_admins for select
  to authenticated
  using (member_id = (select auth.uid()));

insert into public.business_admins (member_id, business_owner_id)
select id, id
from public.profiles
where role = 'admin'
on conflict (member_id) do nothing;

create or replace function private.auth_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid());
$$;

create or replace function private.current_business_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.business_owner_id
  from public.business_admins as membership
  join public.profiles as profile
    on profile.id = membership.member_id
   and profile.role = 'admin'
  where membership.member_id = (select auth.uid())
    and membership.is_active = true;
$$;

revoke all on function private.auth_user_role() from public, anon;
revoke all on function private.current_business_owner_id() from public, anon;
grant execute on function private.auth_user_role() to authenticated;
grant execute on function private.current_business_owner_id() to authenticated;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'leads',
    'trainees',
    'training_sessions',
    'workout_programs',
    'program_days',
    'program_exercises',
    'trainee_monthly_payments',
    'trainee_weekly_goal_notes',
    'finance_expenses',
    'finance_settings'
  ]
  loop
    foreach policy_name in array array[
      table_name || ': admin create',
      table_name || ': admin read',
      table_name || ': admin update',
      table_name || ': admin delete'
    ]
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = private.current_business_owner_id())',
      table_name || ': business admin create',
      table_name
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = private.current_business_owner_id())',
      table_name || ': business admin read',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = private.current_business_owner_id()) with check (owner_id = private.current_business_owner_id())',
      table_name || ': business admin update',
      table_name
    );

    if table_name <> 'finance_settings' then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (owner_id = private.current_business_owner_id())',
        table_name || ': business admin delete',
        table_name
      );
    end if;
  end loop;
end;
$$;

drop policy if exists "profiles: admin update own" on public.profiles;
create policy "profiles: admin update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and private.auth_user_role() = 'admin')
  with check (id = (select auth.uid()));

drop policy if exists "trainees: trainee read own" on public.trainees;
create policy "trainees: trainee read own"
  on public.trainees for select
  to authenticated
  using (user_id = (select auth.uid()) and private.auth_user_role() = 'trainee');

drop policy if exists "training_sessions: trainee read own" on public.training_sessions;
create policy "training_sessions: trainee read own"
  on public.training_sessions for select
  to authenticated
  using (
    private.auth_user_role() = 'trainee'
    and trainee_id in (
      select trainee.id
      from public.trainees as trainee
      where trainee.user_id = (select auth.uid())
    )
  );

create or replace function public.activate_workout_program(p_program_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
  v_program public.workout_programs;
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  select *
    into v_program
    from public.workout_programs
   where id = p_program_id
     and owner_id = v_owner_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Program not found';
  end if;

  update public.workout_programs
     set status = 'archived'
   where owner_id = v_owner_id
     and trainee_id = v_program.trainee_id
     and status = 'active'
     and id <> p_program_id;

  update public.workout_programs
     set status = 'active'
   where id = p_program_id
     and owner_id = v_owner_id;
end;
$$;

create or replace function public.convert_lead_to_trainee(
  p_lead_id uuid,
  p_training_type text,
  p_start_date date
)
returns public.trainees
language plpgsql
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
  v_lead public.leads%rowtype;
  v_trainee public.trainees%rowtype;
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  if p_lead_id is null then
    raise exception using errcode = '22004', message = 'Lead id is required';
  end if;

  if p_training_type is null
    or p_training_type not in (
      U&'\05D0\05D9\05E9\05D9',
      U&'\05D0\05D5\05E0\05DC\05D9\05D9\05DF',
      U&'\05E7\05D1\05D5\05E6\05EA\05D9'
    )
  then
    raise exception using errcode = '22023', message = 'Invalid training type';
  end if;

  if p_start_date is null then
    raise exception using errcode = '22004', message = 'Start date is required';
  end if;

  select *
    into v_lead
    from public.leads
   where id = p_lead_id
     and owner_id = v_owner_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lead not found';
  end if;

  if v_lead.converted_trainee_id is not null then
    select *
      into v_trainee
      from public.trainees
     where id = v_lead.converted_trainee_id
       and owner_id = v_owner_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'Converted trainee not found';
    end if;

    return v_trainee;
  end if;

  insert into public.trainees (
    owner_id, full_name, phone, birth_date, start_date,
    training_type, status, main_goal, notes
  )
  values (
    v_owner_id, v_lead.full_name, v_lead.phone, v_lead.birth_date, p_start_date,
    p_training_type, U&'\05E4\05E2\05D9\05DC', v_lead.goal, v_lead.notes
  )
  returning * into v_trainee;

  update public.leads
     set status = U&'\05D4\05D5\05DE\05E8 \05DC\05DE\05EA\05D0\05DE\05DF',
         converted_trainee_id = v_trainee.id
   where id = v_lead.id
     and owner_id = v_owner_id;

  return v_trainee;
end;
$$;

drop function if exists public.auth_user_role();

commit;
