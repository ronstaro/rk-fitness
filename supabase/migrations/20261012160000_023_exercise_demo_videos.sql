-- 023: A demonstration video per program exercise.
--
-- The video belongs to the existing program_exercises row; there is no
-- separate exercise catalogue. Files live in a private bucket under the
-- business owner's folder: {owner_id}/{uuid}.{ext}. The path does not use the
-- exercise id, so replacing a video always writes a new object and never
-- overwrites one a trainee may be watching.
--
-- Access:
-- * the business admin uploads, reads and deletes files in their own folder;
-- * a trainee only reads a file that is attached to an exercise of their own
--   active program (the subquery runs under the trainee's existing RLS);
-- * nobody updates objects in place, and anon has no access.
-- program_exercises keeps its existing RLS; admins write the new columns
-- through the existing "business admin update" policy.

alter table public.program_exercises
  add column demo_video_path text,
  add column demo_video_uploaded_at timestamptz,
  add constraint program_exercises_demo_video_pair_check
    check ((demo_video_path is null) = (demo_video_uploaded_at is null)),
  add constraint program_exercises_demo_video_path_check
    check (
      demo_video_path is null
      or demo_video_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov|webm|m4v)$'
    );

create index program_exercises_demo_video_path_idx
  on public.program_exercises (demo_video_path)
  where demo_video_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-demo-videos',
  'exercise-demo-videos',
  false,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
);

create policy "exercise demo videos: admin read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'exercise-demo-videos'
    and (storage.foldername(name))[1] = (select private.current_business_owner_id())::text
  );

create policy "exercise demo videos: admin upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'exercise-demo-videos'
    and (storage.foldername(name))[1] = (select private.current_business_owner_id())::text
  );

create policy "exercise demo videos: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'exercise-demo-videos'
    and (storage.foldername(name))[1] = (select private.current_business_owner_id())::text
  );

create policy "exercise demo videos: trainee read active program"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'exercise-demo-videos'
    and (select private.auth_user_role()) = 'trainee'
    and exists (
      select 1
      from public.program_exercises as exercise
      join public.program_days as day on day.id = exercise.program_day_id
      join public.workout_programs as program on program.id = day.program_id
      where exercise.demo_video_path = objects.name
        and program.status = 'active'
        and program.trainee_id = (select private.current_trainee_id())
    )
  );
