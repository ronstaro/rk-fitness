-- ============================================================
-- R.K Fitness — transactional lead-to-trainee conversion
-- ============================================================

create or replace function public.convert_lead_to_trainee(
  p_lead_id uuid,
  p_training_type text,
  p_start_date date
)
returns public.trainees
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_trainee public.trainees%rowtype;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if public.auth_user_role() <> 'admin' then
    raise exception using
      errcode = '42501',
      message = 'Admin access required';
  end if;

  if p_lead_id is null then
    raise exception using
      errcode = '22004',
      message = 'Lead id is required';
  end if;

  if p_training_type is null
    or p_training_type not in (
      U&'\05D0\05D9\05E9\05D9',
      U&'\05D0\05D5\05E0\05DC\05D9\05D9\05DF',
      U&'\05E7\05D1\05D5\05E6\05EA\05D9'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid training type';
  end if;

  if p_start_date is null then
    raise exception using
      errcode = '22004',
      message = 'Start date is required';
  end if;

  select *
    into v_lead
    from public.leads
   where id = p_lead_id
     and owner_id = auth.uid()
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Lead not found';
  end if;

  if v_lead.converted_trainee_id is not null then
    select *
      into v_trainee
      from public.trainees
     where id = v_lead.converted_trainee_id
       and owner_id = auth.uid();

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Converted trainee not found';
    end if;

    return v_trainee;
  end if;

  insert into public.trainees (
    owner_id,
    full_name,
    phone,
    birth_date,
    start_date,
    training_type,
    status,
    main_goal,
    notes
  )
  values (
    auth.uid(),
    v_lead.full_name,
    v_lead.phone,
    v_lead.birth_date,
    p_start_date,
    p_training_type,
    U&'\05E4\05E2\05D9\05DC',
    v_lead.goal,
    v_lead.notes
  )
  returning * into v_trainee;

  update public.leads
     set status = U&'\05D4\05D5\05DE\05E8 \05DC\05DE\05EA\05D0\05DE\05DF',
         converted_trainee_id = v_trainee.id
   where id = v_lead.id;

  return v_trainee;
end;
$$;

revoke all
  on function public.convert_lead_to_trainee(uuid, text, date)
  from public;

revoke execute
  on function public.convert_lead_to_trainee(uuid, text, date)
  from anon;

grant execute
  on function public.convert_lead_to_trainee(uuid, text, date)
  to authenticated;
