-- ============================================================
-- R.K Fitness — lead profile fields
-- ============================================================

alter table public.leads
  add column if not exists email text,
  add column if not exists gender text,
  add column if not exists birth_date date,
  add column if not exists goal text,
  add column if not exists experience_level text,
  add column if not exists service_type text,
  add column if not exists location text,
  add column if not exists availability text,
  add column if not exists referral_name text,
  add column if not exists health_declaration_status text,
  add column if not exists converted_trainee_id uuid;

alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check
    check (
      status in (
        U&'\05D7\05D3\05E9',
        U&'\05E0\05D5\05E6\05E8 \05E7\05E9\05E8',
        U&'\05DE\05E2\05E7\05D1',
        U&'\05E9\05D9\05D7\05EA \05D4\05D9\05DB\05E8\05D5\05EA \05E0\05E7\05D1\05E2\05D4',
        U&'\05D4\05D5\05DE\05E8 \05DC\05DE\05EA\05D0\05DE\05DF',
        U&'\05DC\05D0 \05E8\05DC\05D5\05D5\05E0\05D8\05D9'
      )
    );

alter table public.leads
  drop constraint if exists leads_health_declaration_status_check;

alter table public.leads
  add constraint leads_health_declaration_status_check
    check (
      health_declaration_status is null
      or health_declaration_status in (
        U&'\05DC\05D0 \05E0\05E9\05DC\05D7\05D4',
        U&'\05E0\05E9\05DC\05D7\05D4',
        U&'\05D4\05D5\05E9\05DC\05DE\05D4'
      )
    );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_converted_trainee_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_converted_trainee_id_fkey
      foreign key (converted_trainee_id)
      references public.trainees(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists leads_converted_trainee_id_idx
  on public.leads (converted_trainee_id)
  where converted_trainee_id is not null;
