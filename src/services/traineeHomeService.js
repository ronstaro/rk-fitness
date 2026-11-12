import { supabase } from "../lib/supabase.js";
import { countWorkoutsByProgram } from "../lib/activePrograms.js";

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

// Every active program of the trainee, each with its own workout types and
// exercises. A trainee can hold several active programs at once, so this is
// always a list (never a single-row query) and programs are never merged.
async function fetchActiveProgramsWithDays(traineeId) {
  const { data: programRows, error: programError } = await supabase
    .from("workout_programs")
    .select("id, name, goal, start_date, end_date, duration_weeks, sessions_per_week, notes, created_at")
    .eq("trainee_id", traineeId)
    .eq("status", "active")
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (programError) throw programError;
  if (!programRows?.length) return [];

  const { data: programDays, error: daysError } = await supabase
    .from("program_days")
    .select("id, program_id, name, day_order, notes")
    .in("program_id", programRows.map((program) => program.id))
    .order("day_order", { ascending: true });

  if (daysError) throw daysError;

  let exercises = [];
  if (programDays?.length) {
    const { data, error: exercisesError } = await supabase
      .from("program_exercises")
      .select("id, program_day_id, name, exercise_order, sets, reps, target_weight_kg, target_rir, rest_seconds, notes, demo_video_path, demo_video_url, exercise_group_id")
      .in("program_day_id", programDays.map((day) => day.id))
      .order("exercise_order", { ascending: true });

    if (exercisesError) throw exercisesError;
    exercises = data ?? [];
  }

  return programRows.map((program) => ({
    ...program,
    days: (programDays ?? [])
      .filter((day) => day.program_id === program.id)
      .map((day) => ({
        ...day,
        exercises: exercises.filter((exercise) => exercise.program_day_id === day.id),
      })),
  }));
}

export async function fetchTraineeHomeData() {
  const trainee = await fetchTraineeProfile();

  if (!trainee) {
    return { trainee: null, sessions: [], programs: [] };
  }

  const week = currentWeekRange();
  const [sessionsResult, programs, completedResult, openResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id, session_date, start_time, duration_minutes, training_type, location, status")
      .eq("trainee_id", trainee.id)
      .gte("session_date", week.start)
      .lte("session_date", week.end)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true }),
    fetchActiveProgramsWithDays(trainee.id),
    // Weekly progress counts finished workouts from the workout history,
    // however they were started; a log row is one workout, so none counts twice.
    supabase
      .from("workout_logs")
      .select("id, completed_at, source_program_id")
      .eq("trainee_id", trainee.id)
      .eq("status", "completed")
      .gte("completed_at", week.from.toISOString())
      .lt("completed_at", week.to.toISOString()),
    // At most one open workout per trainee (unique index), whatever program
    // it came from; the workout screen loads it fully.
    supabase
      .from("workout_logs")
      .select("id, day_name, program_name, source_program_id")
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
    completedThisWeekByProgram: countWorkoutsByProgram(completedResult.data),
    openWorkout: openResult.data ?? null,
    programs,
  };
}

export async function fetchTraineeProgramData() {
  const trainee = await fetchTraineeProfile();

  if (!trainee) {
    return { trainee: null, programs: [] };
  }

  const programs = await fetchActiveProgramsWithDays(trainee.id);
  return { trainee, programs };
}

export async function fetchTraineeProfile() {
  const { data, error } = await supabase
    .rpc("get_my_trainee_profile")
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
