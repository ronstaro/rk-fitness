begin;

-- 026: The trainer's demo video becomes a YouTube link instead of an
-- uploaded file. The app stores one canonical form only, so the column can
-- never hold an arbitrary URL. Uploaded files from 023 stay readable until
-- they are removed; nothing existing is changed.
alter table public.program_exercises
  add column demo_video_url text,
  add constraint program_exercises_demo_video_url_check
    check (
      demo_video_url is null
      or demo_video_url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$'
    );

commit;
