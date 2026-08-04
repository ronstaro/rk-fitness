begin;

drop function if exists public.get_my_trainee_profile();

-- Keep the privileged lookup outside the exposed public schema. The function
-- still validates auth.uid() and returns only the approved profile fields.
create or replace function private.get_current_trainee_profile()
returns table (
  id uuid,
  full_name text,
  phone text,
  birth_date date,
  start_date date,
  training_type text,
  main_goal text,
  success_metric text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    trainee.id,
    trainee.full_name,
    trainee.phone,
    trainee.birth_date,
    trainee.start_date,
    trainee.training_type,
    trainee.main_goal,
    trainee.success_metric
  from public.trainees as trainee
  where (select auth.uid()) is not null
    and trainee.id = private.current_trainee_id();
$$;

revoke all on function private.get_current_trainee_profile() from public, anon;
grant execute on function private.get_current_trainee_profile() to authenticated;

-- PostgREST exposes this wrapper, which runs with the caller's privileges.
create function public.get_my_trainee_profile()
returns table (
  id uuid,
  full_name text,
  phone text,
  birth_date date,
  start_date date,
  training_type text,
  main_goal text,
  success_metric text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_current_trainee_profile();
$$;

revoke all on function public.get_my_trainee_profile() from public, anon;
grant execute on function public.get_my_trainee_profile() to authenticated;

commit;
