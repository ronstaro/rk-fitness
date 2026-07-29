alter table public.training_sessions
  drop constraint if exists training_sessions_training_type_check;

alter table public.training_sessions
  drop constraint if exists training_sessions_status_check;

alter table public.training_sessions
  add constraint training_sessions_training_type_check
  check (
    training_type in (
      U&'\05D0\05D9\05E9\05D9',
      U&'\05D0\05D5\05E0\05DC\05D9\05D9\05DF',
      U&'\05E7\05D1\05D5\05E6\05EA\05D9'
    )
  );

alter table public.training_sessions
  add constraint training_sessions_status_check
  check (
    status in (
      U&'\05DE\05EA\05D5\05DB\05E0\05DF',
      U&'\05D4\05D5\05E9\05DC\05DD',
      U&'\05D1\05D5\05D8\05DC',
      U&'\05D3\05D5\05E8\05E9\0020\05EA\05D9\05D0\05D5\05DD'
    )
  );
