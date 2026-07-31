-- ============================================================
-- R.K Fitness — monthly finance tracking
-- ============================================================

create table public.trainee_monthly_payments (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  trainee_id     uuid not null,
  billing_month  date not null,
  trainee_name   text not null,
  package_name   text,
  amount         numeric(10, 2) not null default 0,
  payment_method text,
  payment_status text not null default 'paid',
  paid_at        date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint trainee_monthly_payments_trainee_owner_fk
    foreign key (trainee_id, owner_id)
    references public.trainees(id, owner_id)
    on delete restrict,
  constraint trainee_monthly_payments_month_check
    check (billing_month = date_trunc('month', billing_month)::date),
  constraint trainee_monthly_payments_name_check
    check (char_length(btrim(trainee_name)) > 0),
  constraint trainee_monthly_payments_amount_check check (amount >= 0),
  constraint trainee_monthly_payments_status_check
    check (payment_status in ('paid', 'unpaid')),
  constraint trainee_monthly_payments_owner_trainee_month_key
    unique (owner_id, trainee_id, billing_month)
);

create table public.finance_expenses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  billing_month date not null,
  expense_date  date not null,
  category      text not null,
  description   text,
  amount        numeric(10, 2) not null,
  is_recognized boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint finance_expenses_month_check
    check (billing_month = date_trunc('month', billing_month)::date),
  constraint finance_expenses_category_check
    check (char_length(btrim(category)) > 0),
  constraint finance_expenses_amount_check check (amount > 0)
);

create table public.finance_settings (
  owner_id           uuid primary key references public.profiles(id) on delete cascade,
  vat_rate           numeric(5, 2) not null default 18,
  income_tax_rate    numeric(5, 2) not null default 0,
  prices_include_vat boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint finance_settings_vat_rate_check
    check (vat_rate >= 0 and vat_rate <= 100),
  constraint finance_settings_income_tax_rate_check
    check (income_tax_rate >= 0 and income_tax_rate <= 100)
);

create trigger trainee_monthly_payments_updated_at
  before update on public.trainee_monthly_payments
  for each row execute function public.set_updated_at();

create trigger finance_expenses_updated_at
  before update on public.finance_expenses
  for each row execute function public.set_updated_at();

create trigger finance_settings_updated_at
  before update on public.finance_settings
  for each row execute function public.set_updated_at();

create index trainee_monthly_payments_owner_month_idx
  on public.trainee_monthly_payments (owner_id, billing_month);
create index trainee_monthly_payments_trainee_idx
  on public.trainee_monthly_payments (trainee_id);
create index finance_expenses_owner_month_idx
  on public.finance_expenses (owner_id, billing_month);

alter table public.trainee_monthly_payments enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_settings enable row level security;

create policy "trainee_monthly_payments: admin create"
  on public.trainee_monthly_payments for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "trainee_monthly_payments: admin read"
  on public.trainee_monthly_payments for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "trainee_monthly_payments: admin update"
  on public.trainee_monthly_payments for update
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "trainee_monthly_payments: admin delete"
  on public.trainee_monthly_payments for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "finance_expenses: admin create"
  on public.finance_expenses for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "finance_expenses: admin read"
  on public.finance_expenses for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "finance_expenses: admin update"
  on public.finance_expenses for update
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "finance_expenses: admin delete"
  on public.finance_expenses for delete
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "finance_settings: admin create"
  on public.finance_settings for insert
  to authenticated
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "finance_settings: admin read"
  on public.finance_settings for select
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin');

create policy "finance_settings: admin update"
  on public.finance_settings for update
  to authenticated
  using (owner_id = auth.uid() and public.auth_user_role() = 'admin')
  with check (owner_id = auth.uid() and public.auth_user_role() = 'admin');

grant select, insert, update, delete on public.trainee_monthly_payments to authenticated;
grant select, insert, update, delete on public.finance_expenses to authenticated;
grant select, insert, update on public.finance_settings to authenticated;
