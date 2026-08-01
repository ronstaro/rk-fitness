import { supabase } from "../lib/supabase.js";

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("לא ניתן לקבל את פרטי המשתמש המחובר");
  }

  return user.id;
}

export async function fetchWeeklyGoalNotes(weekStart) {
  const { data, error } = await supabase
    .from("trainee_weekly_goal_notes")
    .select("id, trainee_id, week_start, note, updated_at")
    .eq("week_start", weekStart);

  if (error) throw error;
  return data;
}

export async function saveWeeklyGoalNote({ traineeId, weekStart, note }) {
  const ownerId = await getCurrentUserId();
  const normalizedNote = note.trim();

  if (!normalizedNote) {
    const { error } = await supabase
      .from("trainee_weekly_goal_notes")
      .delete()
      .eq("trainee_id", traineeId)
      .eq("week_start", weekStart);

    if (error) throw error;
    return null;
  }

  const { data, error } = await supabase
    .from("trainee_weekly_goal_notes")
    .upsert(
      {
        owner_id: ownerId,
        trainee_id: traineeId,
        week_start: weekStart,
        note: normalizedNote,
      },
      { onConflict: "owner_id,trainee_id,week_start" }
    )
    .select("id, trainee_id, week_start, note, updated_at")
    .single();

  if (error) throw error;
  return data;
}
