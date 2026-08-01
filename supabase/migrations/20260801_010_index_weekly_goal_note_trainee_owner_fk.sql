-- Cover the composite trainee ownership foreign key in its lookup order.
create index trainee_weekly_goal_notes_trainee_owner_idx
  on public.trainee_weekly_goal_notes (trainee_id, owner_id);
