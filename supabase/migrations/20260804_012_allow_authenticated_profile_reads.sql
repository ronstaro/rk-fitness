begin;

-- The profile select policy already limits each authenticated user to their
-- own row. This table privilege is also required before PostgREST can apply
-- that RLS policy.
grant select on table public.profiles to authenticated;

commit;
