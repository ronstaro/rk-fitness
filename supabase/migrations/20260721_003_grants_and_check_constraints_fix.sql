grant usage on schema public to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.trainees to authenticated;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in (
    U&'\05D7\05D3\05E9',
    U&'\05E0\05D5\05E6\05E8 \05E7\05E9\05E8',
    U&'\05DE\05E2\05E7\05D1',
    U&'\05D4\05D5\05DE\05E8 \05DC\05DE\05EA\05D0\05DE\05DF',
    U&'\05DC\05D0 \05E8\05DC\05D5\05D5\05E0\05D8\05D9'
  ));

alter table public.trainees drop constraint if exists trainees_training_type_check;
alter table public.trainees add constraint trainees_training_type_check
  check (training_type in (
    U&'\05D0\05D9\05E9\05D9',
    U&'\05D0\05D5\05E0\05DC\05D9\05D9\05DF',
    U&'\05E7\05D1\05D5\05E6\05EA\05D9'
  ));

alter table public.trainees drop constraint if exists trainees_status_check;
alter table public.trainees add constraint trainees_status_check
  check (status in (
    U&'\05E4\05E2\05D9\05DC',
    U&'\05D1\05D4\05E7\05E4\05D0\05D4',
    U&'\05D3\05D5\05E8\05E9 \05DE\05E2\05E7\05D1',
    U&'\05D4\05E1\05EA\05D9\05D9\05DD'
  ));
