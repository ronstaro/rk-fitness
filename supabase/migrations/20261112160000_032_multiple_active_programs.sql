-- ============================================================
-- R.K Fitness — 032: several active workout programs per trainee
-- ============================================================
-- A trainee may follow several programs at once (strength, cardio,
-- mobility...). Until now one active program per trainee was enforced by a
-- unique partial index, and activating a program archived the others.
--
-- After this migration:
--   * any number of a trainee's programs may be active;
--   * activate_workout_program only activates the requested program;
--   * archiving is an explicit admin action (archive_workout_program).
--
-- Unchanged on purpose: every RLS policy (they already check each program
-- row on its own), start_current_trainee_workout (it already accepts any
-- active program of the caller and still returns the one open workout), the
-- one-open-workout-per-trainee index, and all existing rows.

begin;

drop index if exists public.workout_programs_one_active_per_trainee;

-- Same signature, language, invoker security, search_path and ownership
-- check as 011; only the archive-the-others step is gone. Grants are kept by
-- CREATE OR REPLACE (authenticated only, as set in 003).
create or replace function public.activate_workout_program(p_program_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  update public.workout_programs
     set status = 'active'
   where id = p_program_id
     and owner_id = v_owner_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Program not found';
  end if;
end;
$$;

-- Explicit archive by an admin of the program's business. Invoker security:
-- the admin's own RLS on workout_programs applies on top of the owner check.
-- Archiving never activates another program and never touches workout
-- history; an open workout that came from this program stays resumable.
create or replace function public.archive_workout_program(p_program_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  update public.workout_programs
     set status = 'archived'
   where id = p_program_id
     and owner_id = v_owner_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Program not found';
  end if;
end;
$$;

revoke all on function public.archive_workout_program(uuid) from public;
revoke all on function public.archive_workout_program(uuid) from anon;
revoke all on function public.archive_workout_program(uuid) from service_role;
grant execute on function public.archive_workout_program(uuid) to authenticated;

commit;
