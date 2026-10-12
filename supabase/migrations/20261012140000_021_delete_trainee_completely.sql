-- 021: Admin deletes a trainee together with its linked login account.
--
-- Deleting a trainee already cascades to its sessions, programs, workout logs,
-- weekly goal notes and invitations (payments keep their row with
-- trainee_id = null). This function also deletes the linked auth user, so the
-- email can be registered again. auth.users -> public.profiles is ON DELETE
-- CASCADE, so the profile goes with it.
--
-- Deleting a profile cascades to every row it owns (owner_id), so the linked
-- account must be a plain trainee account. The function refuses admins,
-- business owners/members, the caller and any inconsistent linkage, and then
-- deletes nothing. Everything runs in one transaction.
--
-- The client passes only the trainee id. The linked user id is read from the
-- trainee row on the server.

create or replace function private.delete_trainee_completely(p_trainee_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
  v_caller_id uuid := (select auth.uid());
  v_user_id uuid;
  v_role text;
  v_rows integer;
begin
  if v_caller_id is null or v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  if p_trainee_id is null then
    raise exception using errcode = '22004', message = 'Trainee id is required';
  end if;

  -- Lock the trainee row so a concurrent invite accept cannot link it meanwhile.
  select trainee.user_id
    into v_user_id
    from public.trainees as trainee
   where trainee.id = p_trainee_id
     and trainee.owner_id = v_owner_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Trainee not found';
  end if;

  if v_user_id is not null then
    if v_user_id = v_caller_id then
      raise exception using errcode = '42501', message = 'Cannot delete own account';
    end if;

    select profile.role into v_role
      from public.profiles as profile
     where profile.id = v_user_id;

    if v_role is distinct from 'trainee' then
      raise exception using errcode = '42501', message = 'Linked account is not a trainee account';
    end if;

    if exists (
      select 1
        from public.business_admins as membership
       where membership.member_id = v_user_id
          or membership.business_owner_id = v_user_id
    ) then
      raise exception using errcode = '42501', message = 'Linked account is not a trainee account';
    end if;

    -- trainees.user_id is unique, but stay defensive: the account must be
    -- linked to this trainee only, and must not own any business data.
    if (select count(*) from public.trainees as other where other.user_id = v_user_id) <> 1
       or exists (select 1 from public.trainees as owned where owned.owner_id = v_user_id) then
      raise exception using errcode = '42501', message = 'Linked account is inconsistent';
    end if;
  end if;

  delete from public.trainees as trainee
   where trainee.id = p_trainee_id
     and trainee.owner_id = v_owner_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = 'P0002', message = 'Trainee not found';
  end if;

  if v_user_id is not null then
    delete from auth.users as account where account.id = v_user_id;

    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception using errcode = 'P0002', message = 'Linked account not found';
    end if;
  end if;

  return jsonb_build_object('trainee_deleted', true, 'account_deleted', v_user_id is not null);
end;
$$;

-- PostgREST exposes this wrapper, which runs with the caller's privileges.
create or replace function public.delete_trainee_completely(p_trainee_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.delete_trainee_completely(p_trainee_id);
$$;

revoke all on function private.delete_trainee_completely(uuid) from public, anon;
revoke all on function public.delete_trainee_completely(uuid) from public, anon;
grant execute on function private.delete_trainee_completely(uuid) to authenticated;
grant execute on function public.delete_trainee_completely(uuid) to authenticated;
