begin;

-- Token generation relies on pgcrypto. Fail the whole migration early if it
-- is not installed in the Supabase extensions schema.
do $$
begin
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception 'pgcrypto is required: extensions.gen_random_bytes(integer) not found';
  end if;
end;
$$;

-- Invitations live in the private schema, which PostgREST does not expose.
-- Only the security definer functions below read or write this table.
create table private.trainee_invitations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  trainee_id  uuid not null,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  token_hash  bytea not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  used_by     uuid references public.profiles(id) on delete set null,
  revoked_at  timestamptz,
  constraint trainee_invitations_token_hash_key unique (token_hash),
  constraint trainee_invitations_trainee_owner_fk
    foreign key (trainee_id, owner_id)
    references public.trainees(id, owner_id)
    on delete cascade,
  constraint trainee_invitations_token_hash_check
    check (octet_length(token_hash) = 32),
  constraint trainee_invitations_expiry_check
    check (expires_at > created_at),
  constraint trainee_invitations_used_check
    check (used_by is null or used_at is not null),
  constraint trainee_invitations_used_or_revoked_check
    check (used_at is null or revoked_at is null)
);

comment on table private.trainee_invitations is
  'Single-use, expiring invitations that link an auth account to one trainee row. Stores only sha256(token).';

-- At most one active (not used, not revoked) invitation per trainee.
create unique index trainee_invitations_one_active_per_trainee
  on private.trainee_invitations (trainee_id)
  where used_at is null and revoked_at is null;

create index trainee_invitations_trainee_owner_idx
  on private.trainee_invitations (trainee_id, owner_id);
create index trainee_invitations_owner_idx
  on private.trainee_invitations (owner_id);
create index trainee_invitations_created_by_idx
  on private.trainee_invitations (created_by);
create index trainee_invitations_used_by_idx
  on private.trainee_invitations (used_by)
  where used_by is not null;

alter table private.trainee_invitations enable row level security;
revoke all on table private.trainee_invitations from public, anon, authenticated;

-- ------------------------------------------------------------
-- Admin: create an invitation and return the raw token once.
-- ------------------------------------------------------------
create or replace function private.create_trainee_invite(p_trainee_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
  v_user_id uuid;
  v_token text;
begin
  if (select auth.uid()) is null or v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  if p_trainee_id is null then
    raise exception using errcode = '22004', message = 'Trainee id is required';
  end if;

  -- Lock the trainee row so concurrent create/accept calls serialize.
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
    raise exception using errcode = '22023', message = 'Trainee already linked';
  end if;

  update private.trainee_invitations
     set revoked_at = now()
   where trainee_id = p_trainee_id
     and used_at is null
     and revoked_at is null;

  -- 32 random bytes = 256 bits, encoded as unpadded base64url (43 chars).
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into private.trainee_invitations (owner_id, trainee_id, created_by, token_hash)
  values (v_owner_id, p_trainee_id, (select auth.uid()), sha256(convert_to(v_token, 'UTF8')));

  return v_token;
end;
$$;

-- ------------------------------------------------------------
-- Admin: revoke the active invitation for a trainee.
-- ------------------------------------------------------------
create or replace function private.revoke_trainee_invite(p_trainee_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
begin
  if (select auth.uid()) is null or v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  if not exists (
    select 1
    from public.trainees as trainee
    where trainee.id = p_trainee_id
      and trainee.owner_id = v_owner_id
  ) then
    raise exception using errcode = 'P0002', message = 'Trainee not found';
  end if;

  update private.trainee_invitations
     set revoked_at = now()
   where trainee_id = p_trainee_id
     and owner_id = v_owner_id
     and used_at is null
     and revoked_at is null;

  return found;
end;
$$;

-- ------------------------------------------------------------
-- Admin: invitation status for one trainee. Never returns token data.
-- status: linked | pending | expired | revoked | none
-- ------------------------------------------------------------
create or replace function private.get_trainee_invite_status(p_trainee_id uuid)
returns table (
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := private.current_business_owner_id();
  v_user_id uuid;
begin
  if (select auth.uid()) is null or v_owner_id is null then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  select trainee.user_id
    into v_user_id
    from public.trainees as trainee
   where trainee.id = p_trainee_id
     and trainee.owner_id = v_owner_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Trainee not found';
  end if;

  return query
  select
    case
      when v_user_id is not null then 'linked'
      when invite.id is null then 'none'
      when invite.revoked_at is not null then 'revoked'
      when invite.used_at is not null then 'none'
      when invite.expires_at <= now() then 'expired'
      else 'pending'
    end,
    invite.created_at,
    invite.expires_at,
    invite.used_at
  from (select 1) as anchor
  left join lateral (
    select candidate.id, candidate.created_at, candidate.expires_at,
           candidate.used_at, candidate.revoked_at
    from private.trainee_invitations as candidate
    where candidate.trainee_id = p_trainee_id
      and candidate.owner_id = v_owner_id
    order by candidate.created_at desc
    limit 1
  ) as invite on true;
end;
$$;

-- ------------------------------------------------------------
-- Trainee: redeem an invitation and link the caller to the trainee row.
-- Every token problem returns the same generic error.
-- ------------------------------------------------------------
create or replace function private.accept_trainee_invite(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite private.trainee_invitations%rowtype;
  v_linked_user_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if (select private.auth_user_role()) is distinct from 'trainee' then
    raise exception using errcode = '42501', message = 'Account not eligible';
  end if;

  if p_token is null or char_length(p_token) <> 43 then
    raise exception using errcode = '22023', message = 'Invite invalid';
  end if;

  -- Lock the invitation row: concurrent redemptions of the same token wait
  -- here and then see used_at set.
  select *
    into v_invite
    from private.trainee_invitations as invite
   where invite.token_hash = sha256(convert_to(p_token, 'UTF8'))
   for update;

  if not found then
    raise exception using errcode = '22023', message = 'Invite invalid';
  end if;

  if v_invite.used_at is not null then
    -- Same account redeeming its own invite again (refresh/retry) succeeds.
    if v_invite.used_by = v_user_id and exists (
      select 1
      from public.trainees as trainee
      where trainee.id = v_invite.trainee_id
        and trainee.user_id = v_user_id
    ) then
      return v_invite.trainee_id;
    end if;

    raise exception using errcode = '22023', message = 'Invite invalid';
  end if;

  if v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Invite invalid';
  end if;

  if exists (
    select 1
    from public.trainees as trainee
    where trainee.user_id = v_user_id
  ) then
    raise exception using errcode = '22023', message = 'Account already linked';
  end if;

  select trainee.user_id
    into v_linked_user_id
    from public.trainees as trainee
   where trainee.id = v_invite.trainee_id
     and trainee.owner_id = v_invite.owner_id
   for update;

  if not found or v_linked_user_id is not null then
    raise exception using errcode = '22023', message = 'Invite invalid';
  end if;

  begin
    update public.trainees
       set user_id = v_user_id
     where id = v_invite.trainee_id
       and owner_id = v_invite.owner_id
       and user_id is null;
  exception
    -- trainees.user_id is unique: a parallel redemption of another invite by
    -- the same account already linked it.
    when unique_violation then
      raise exception using errcode = '22023', message = 'Account already linked';
  end;

  if not found then
    raise exception using errcode = '22023', message = 'Invite invalid';
  end if;

  update private.trainee_invitations
     set used_at = now(),
         used_by = v_user_id
   where id = v_invite.id;

  return v_invite.trainee_id;
end;
$$;

revoke all on function private.create_trainee_invite(uuid) from public, anon;
revoke all on function private.revoke_trainee_invite(uuid) from public, anon;
revoke all on function private.get_trainee_invite_status(uuid) from public, anon;
revoke all on function private.accept_trainee_invite(text) from public, anon;
grant execute on function private.create_trainee_invite(uuid) to authenticated;
grant execute on function private.revoke_trainee_invite(uuid) to authenticated;
grant execute on function private.get_trainee_invite_status(uuid) to authenticated;
grant execute on function private.accept_trainee_invite(text) to authenticated;

-- PostgREST exposes these wrappers, which run with the caller's privileges.
create or replace function public.create_trainee_invite(p_trainee_id uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_trainee_invite(p_trainee_id);
$$;

create or replace function public.revoke_trainee_invite(p_trainee_id uuid)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.revoke_trainee_invite(p_trainee_id);
$$;

create or replace function public.get_trainee_invite_status(p_trainee_id uuid)
returns table (
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_trainee_invite_status(p_trainee_id);
$$;

create or replace function public.accept_trainee_invite(p_token text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.accept_trainee_invite(p_token);
$$;

revoke all on function public.create_trainee_invite(uuid) from public, anon;
revoke all on function public.revoke_trainee_invite(uuid) from public, anon;
revoke all on function public.get_trainee_invite_status(uuid) from public, anon;
revoke all on function public.accept_trainee_invite(text) from public, anon;
grant execute on function public.create_trainee_invite(uuid) to authenticated;
grant execute on function public.revoke_trainee_invite(uuid) to authenticated;
grant execute on function public.get_trainee_invite_status(uuid) to authenticated;
grant execute on function public.accept_trainee_invite(text) to authenticated;

commit;
