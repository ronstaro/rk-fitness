-- 031: Admin deletes a completed workout that a trainee logged by mistake.
--
-- authenticated still has no DELETE grant on workout_logs or its child
-- tables. The only way to delete a workout is the RPC below, which checks on
-- the server that the caller is an admin of the business that owns the
-- workout, and that the workout is completed (an open workout may be in use on
-- the trainee's phone right now). Exercises and sets go with it through the
-- existing ON DELETE CASCADE foreign keys, in the same transaction.
--
-- The RPC returns only the storage paths of the workout's videos. The client
-- removes those files afterwards, best-effort. The storage policies below let
-- an admin read/remove a workout video only once no workout exercise points
-- at it any more, so they cannot be used to remove the video of a workout
-- that still exists.

begin;

create or replace function private.delete_workout_log(p_workout_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_video_paths text[];
  v_rows integer;
begin
  if (select auth.uid()) is null
    or (select private.auth_user_role()) is distinct from 'admin' then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  v_owner_id := (select private.current_business_owner_id());
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if p_workout_id is null then
    raise exception using errcode = '22004', message = 'Workout id is required';
  end if;

  -- Lock the row so a concurrent review save cannot interleave.
  perform 1
  from public.workout_logs as workout
  where workout.id = p_workout_id
    and workout.owner_id = v_owner_id
    and workout.status = 'completed'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Completed workout not found';
  end if;

  select coalesce(array_agg(distinct exercise.video_path), '{}')
  into v_video_paths
  from public.workout_log_exercises as exercise
  where exercise.workout_log_id = p_workout_id
    and exercise.video_path is not null;

  delete from public.workout_logs as workout
  where workout.id = p_workout_id
    and workout.owner_id = v_owner_id
    and workout.status = 'completed';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = 'P0002', message = 'Completed workout not found';
  end if;

  return jsonb_build_object('video_paths', to_jsonb(v_video_paths));
end;
$$;

revoke all on function private.delete_workout_log(uuid) from public, anon;
grant execute on function private.delete_workout_log(uuid) to authenticated;

-- PostgREST exposes this wrapper, which runs with the caller's privileges.
create or replace function public.delete_workout_log(p_workout_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.delete_workout_log(p_workout_id);
$$;

revoke all on function public.delete_workout_log(uuid) from public, anon;
grant execute on function public.delete_workout_log(uuid) to authenticated;

-- Storage removes objects with DELETE ... RETURNING, so the caller needs a
-- matching SELECT policy as well as the DELETE policy. Both are limited to
-- files under a trainee of the admin's own business that no workout exercise
-- references any more (the admin can read every exercise of her business, so
-- the NOT EXISTS sees all rows that could reference the file).
create policy "workout videos: admin read orphaned"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workout-videos'
    and exists (
      select 1
      from public.trainees as trainee
      where trainee.id::text = (storage.foldername(objects.name))[1]
        and trainee.owner_id = (select private.current_business_owner_id())
    )
    and not exists (
      select 1
      from public.workout_log_exercises as exercise
      where exercise.video_path = objects.name
    )
  );

create policy "workout videos: admin delete orphaned"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workout-videos'
    and exists (
      select 1
      from public.trainees as trainee
      where trainee.id::text = (storage.foldername(objects.name))[1]
        and trainee.owner_id = (select private.current_business_owner_id())
    )
    and not exists (
      select 1
      from public.workout_log_exercises as exercise
      where exercise.video_path = objects.name
    )
  );

commit;
