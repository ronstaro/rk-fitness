import { supabase } from "../lib/supabase.js";

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentWeekRange() {
  const today = new Date();
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  start.setDate(today.getDate() - today.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start: localDateKey(start), end: localDateKey(end) };
}

export async function fetchTraineeHomeData() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("לא ניתן לזהות את המשתמש המחובר");
  }

  const { data: trainee, error: traineeError } = await supabase
    .from("trainees")
    .select("id, full_name, start_date, training_type, status, main_goal, success_metric")
    .eq("user_id", user.id)
    .maybeSingle();

  if (traineeError) throw traineeError;
  if (!trainee) {
    return { trainee: null, sessions: [], program: null, days: [] };
  }

  const week = currentWeekRange();
  const [sessionsResult, programResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id, session_date, start_time, duration_minutes, training_type, location, status")
      .eq("trainee_id", trainee.id)
      .gte("session_date", week.start)
      .lte("session_date", week.end)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("workout_programs")
      .select("id, name, goal, start_date, end_date, duration_weeks, sessions_per_week")
      .eq("trainee_id", trainee.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (programResult.error) throw programResult.error;

  const program = programResult.data;
  if (!program) {
    return {
      trainee,
      sessions: sessionsResult.data ?? [],
      program: null,
      days: [],
    };
  }

  const daysResult = await supabase
    .from("program_days")
    .select("id, program_id, name, day_order")
    .eq("program_id", program.id)
    .order("day_order", { ascending: true });
  if (daysResult.error) throw daysResult.error;

  const programDays = daysResult.data ?? [];
  if (programDays.length === 0) {
    return {
      trainee,
      sessions: sessionsResult.data ?? [],
      program,
      days: [],
    };
  }

  const exercisesResult = await supabase
    .from("program_exercises")
    .select("id, program_day_id, name, exercise_order, sets, reps, target_rir, rest_seconds")
    .in("program_day_id", programDays.map((day) => day.id))
    .order("exercise_order", { ascending: true });

  if (exercisesResult.error) throw exercisesResult.error;

  const exercises = exercisesResult.data ?? [];
  const days = programDays.map((day) => ({
    ...day,
    exercises: exercises.filter((exercise) => exercise.program_day_id === day.id),
  }));

  return {
    trainee,
    sessions: sessionsResult.data ?? [],
    program,
    days,
  };
}
