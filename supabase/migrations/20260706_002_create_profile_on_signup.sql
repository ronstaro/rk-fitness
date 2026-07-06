-- ============================================================
-- R.K Fitness — auto-create profile row on signup
-- ============================================================

-- ------------------------------------------------------------
-- handle_new_user
--
-- SECURITY DECISION: All new signups are inserted with role = 'trainee'
-- regardless of what role value appears in raw_user_meta_data.
-- This prevents any user from self-registering as admin by crafting
-- metadata. The first admin account must be promoted manually by the
-- database owner through a controlled SQL statement:
--
--   update public.profiles set role = 'admin' where id = '<uuid>';
--
-- The metadata 'role' field is accepted in the function signature for
-- documentation purposes only and must never control the inserted role.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'trainee'  -- always trainee; promotion to admin is manual only
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Revoke direct client execution.
-- This function is only meant to be called by the database trigger.
-- Security definer + empty search_path already limits its scope,
-- but removing public execute prevents accidental or malicious direct calls.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- ------------------------------------------------------------
-- Trigger on auth.users
-- ------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
