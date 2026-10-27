begin;

-- Trainer feedback belongs to the completed workout snapshot, never to the
-- program, so later program edits cannot change what the trainee was told.
alter table public.workout_log_exercises
  add column trainer_feedback text,
  add constraint workout_log_exercises_trainer_feedback_check
    check (trainer_feedback is null or char_length(btrim(trainer_feedback)) between 1 and 2000);

alter table public.workout_logs
  add column trainer_feedback text,
  add column trainer_reviewed_at timestamptz,
  add column trainer_reviewed_by uuid references public.profiles(id) on delete set null,
  add constraint workout_logs_trainer_feedback_check
    check (trainer_feedback is null or char_length(btrim(trainer_feedback)) between 1 and 4000),
  add constraint workout_logs_trainer_review_completed_check
    check (trainer_reviewed_at is null or status = 'completed');

create index workout_logs_trainer_reviewed_by_idx
  on public.workout_logs (trainer_reviewed_by)
  where trainer_reviewed_by is not null;

-- No column UPDATE grants are added: the trainee "update open" policies stay
-- limited to their existing columns, and admins write only through the RPC
-- below, which also sets the reviewer fields server-side.
create or replace function private.save_workout_review(
  p_workout_id uuid,
  p_general_feedback text,
  p_exercise_feedback jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_reviewed_at timestamptz := now();
  v_unknown_count integer;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is distinct from 'admin' then
    raise exception 'Not authorized';
  end if;

  v_owner_id := (select private.current_business_owner_id());
  if v_owner_id is null then
    raise exception 'Not authorized';
  end if;

  if p_exercise_feedback is null or jsonb_typeof(p_exercise_feedback) <> 'array' then
    raise exception 'Invalid exercise feedback';
  end if;

  perform 1
  from public.workout_logs as workout
  where workout.id = p_workout_id
    and workout.owner_id = v_owner_id
    and workout.status = 'completed'
  for update;

  if not found then
    raise exception 'Completed workout not found';
  end if;

  select count(*)
  into v_unknown_count
  from jsonb_array_elements(p_exercise_feedback) as item
  where not exists (
    select 1
    from public.workout_log_exercises as exercise
    where exercise.id::text = item->>'id'
      and exercise.workout_log_id = p_workout_id
  );

  if v_unknown_count > 0
    or (select count(distinct item->>'id') from jsonb_array_elements(p_exercise_feedback) as item)
       <> jsonb_array_length(p_exercise_feedback) then
    raise exception 'Exercise does not belong to workout';
  end if;

  update public.workout_log_exercises as exercise
  set trainer_feedback = nullif(btrim(item->>'feedback'), '')
  from jsonb_array_elements(p_exercise_feedback) as item
  where exercise.id::text = item->>'id'
    and exercise.workout_log_id = p_workout_id
    and exercise.trainer_feedback is distinct from nullif(btrim(item->>'feedback'), '');

  update public.workout_logs
  set trainer_feedback = nullif(btrim(p_general_feedback), ''),
      trainer_reviewed_at = v_reviewed_at,
      trainer_reviewed_by = (select auth.uid())
  where id = p_workout_id;

  return v_reviewed_at;
end;
$$;

revoke all on function private.save_workout_review(uuid, text, jsonb) from public, anon;
grant execute on function private.save_workout_review(uuid, text, jsonb) to authenticated;

create or replace function public.save_workout_review(
  p_workout_id uuid,
  p_general_feedback text,
  p_exercise_feedback jsonb
)
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.save_workout_review(p_workout_id, p_general_feedback, p_exercise_feedback);
$$;

revoke all on function public.save_workout_review(uuid, text, jsonb) from public, anon;
grant execute on function public.save_workout_review(uuid, text, jsonb) to authenticated;

commit;
