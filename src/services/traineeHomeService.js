import { supabase } from "../lib/supabase.js";

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The product week is Sunday to Saturday on the trainee's device clock
// (Israel). from/to bound timestamps (completed_at); start/end are the
// inclusive date keys used for training_sessions.session_date.
export function currentWeekRange(now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - from.getDay());

  const to = new Date(from);
  to.setDate(from.getDate() + 7);

  const last = new Date(from);
  last.setDate(from.getDate() + 6);

  return { start: localDateKey(from), end: localDateKey(last), from, to };
}

async function fetchActiveProgramWithDays(traineeId) {
  const { data: program, error: programError } = await supabase
    .from("workout_programs")
    .select("id, name, goal, start_date, end_date, duration_weeks, sessions_per_week, notes")
    .eq("trainee_id", traineeId)
    .eq("status", "active")
    .maybeSingle();

  if (programError) throw programError;
  if (!program) return { program: null, days: [] };

  const { data: programDays, error: daysError } = await supabase
    .from("program_days")
    .select("id, program_id, name, day_order, notes")
    .eq("program_id", program.id)
    .order("day_order", { ascending: true });

  if (daysError) throw daysError;
  if (!programDays?.length) return { program, days: [] };

  const { data: exercises, error: exercisesError } = await supabase
    .from("program_exercises")
    .select("id, program_day_id, name, exercise_order, sets, reps, target_weight_kg, target_rir, rest_seconds, notes, demo_video_path, demo_video_url, exercise_group_id")
    .in("program_day_id", programDays.map((day) => day.id))
    .order("exercise_order", { ascending: true });

  if (exercisesError) throw exercisesError;

  return {
    program,
    days: programDays.map((day) => ({
      ...day,
      exercises: (exercises ?? []).filter(
        (exercise) => exercise.program_day_id === day.id
      ),
    })),
  };
}

export async function fetchTraineeHomeData() {
  const trainee = await fetchTraineeProfile();

  if (!trainee) {
    return { trainee: null, sessions: [], program: null, days: [] };
  }

  const week = currentWeekRange();
  const [sessionsResult, programData, completedResult, openResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id, session_date, start_time, duration_minutes, training_type, location, status")
      .eq("trainee_id", trainee.id)
      .gte("session_date", week.start)
      .lte("session_date", week.end)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true }),
    fetchActiveProgramWithDays(trainee.id),
    // Weekly progress counts finished workouts from the workout history,
    // however they were started; a log row is one workout, so none counts twice.
    supabase
      .from("workout_logs")
      .select("id, completed_at")
      .eq("trainee_id", trainee.id)
      .eq("status", "completed")
      .gte("completed_at", week.from.toISOString())
      .lt("completed_at", week.to.toISOString()),
    // Only the open workout's name is needed here; the workout screen loads it fully.
    supabase
      .from("workout_logs")
      .select("id, day_name")
      .eq("trainee_id", trainee.id)
      .eq("status", "in_progress")
      .maybeSingle(),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (completedResult.error) throw completedResult.error;
  if (openResult.error) throw openResult.error;

  return {
    trainee,
    sessions: sessionsResult.data ?? [],
    completedWorkoutsThisWeek: completedResult.data?.length ?? 0,
    openWorkout: openResult.data ?? null,
    ...programData,
  };
}

export async function fetchTraineeProgramData() {
  const trainee = await fetchTraineeProfile();

  if (!trainee) {
    return { trainee: null, program: null, days: [] };
  }

  const programData = await fetchActiveProgramWithDays(trainee.id);
  return { trainee, ...programData };
}

export async function fetchTraineeProfile() {
  const { data, error } = await supabase
    .rpc("get_my_trainee_profile")
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
