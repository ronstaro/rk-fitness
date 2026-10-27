begin;

-- 028: The trainer's demo link may point to any https video page (YouTube,
-- Instagram, TikTok, Vimeo, Google Drive, ...), not only YouTube. The column
-- from 026 stays; only its check changes. Plain http, javascript: and other
-- schemes, spaces and free text are still rejected. Existing links (canonical
-- YouTube URLs) already satisfy the new check.
alter table public.program_exercises
  drop constraint program_exercises_demo_video_url_check,
  add constraint program_exercises_demo_video_url_check
    check (
      demo_video_url is null
      or (
        char_length(demo_video_url) <= 2000
        and demo_video_url ~ '^https://[^/?#[:space:]]+\.[^/?#[:space:]]+([/?#][^[:space:]]*)?$'
      )
    );

commit;
