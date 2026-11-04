import { supabase } from "../lib/supabase.js";
import { getBusinessOwnerId } from "./accessService.js";

export async function fetchWeeklyGoalNotes(weekStart) {
  const { data, error } = await supabase
    .from("trainee_weekly_goal_notes")
    .select("id, trainee_id, week_start, note, updated_at")
    .eq("week_start", weekStart);

  if (error) throw error;
  return data;
}

export async function saveWeeklyGoalNote({ traineeId, weekStart, note }) {
  const ownerId = await getBusinessOwnerId();
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

// Completed workouts per trainee in [from, to), from the workout history —
// the same source and week window as the trainee's Home weekly progress.
export async function fetchCompletedWorkoutCounts(from, to) {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("trainee_id")
    .eq("status", "completed")
    .gte("completed_at", from.toISOString())
    .lt("completed_at", to.toISOString());

  if (error) throw error;
  return (data ?? []).reduce((counts, row) => {
    counts[row.trainee_id] = (counts[row.trainee_id] || 0) + 1;
    return counts;
  }, {});
}
