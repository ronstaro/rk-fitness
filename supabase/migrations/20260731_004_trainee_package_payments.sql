-- ============================================================
-- R.K Fitness — trainee package and payment details
-- ============================================================

alter table public.trainees
  add column if not exists package_name text,
  add column if not exists package_price numeric(10, 2),
  add column if not exists payment_method text,
  add column if not exists payment_status text,
  add column if not exists next_payment_date date;

alter table public.trainees
  add constraint trainees_package_price_check
    check (package_price is null or package_price >= 0),
  add constraint trainees_payment_method_check
    check (
      payment_method is null
      or payment_method in ('אשראי', 'העברה בנקאית', 'Bit', 'מזומן', 'אחר')
    ),
  add constraint trainees_payment_status_check
    check (
      payment_status is null
      or payment_status in ('שולם', 'ממתין לתשלום', 'באיחור')
    );
