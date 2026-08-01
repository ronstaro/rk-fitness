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

export async function fetchPrograms() {
  const { data, error } = await supabase
    .from("workout_programs")
    .select("*, program_days(id)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map((program) => ({
    ...program,
    days_count: program.program_days?.length ?? 0,
    program_days: undefined,
  }));
}

export async function fetchActivePrograms() {
  const { data, error } = await supabase
    .from("workout_programs")
    .select(
      "id, trainee_id, name, goal, status, start_date, end_date, duration_weeks, sessions_per_week"
    )
    .eq("status", "active");

  if (error) throw error;
  return data;
}

export async function fetchProgramDetails(programId) {
  const [{ data: days, error: daysError }, { data: exercises, error: exercisesError }] =
    await Promise.all([
      supabase
        .from("program_days")
        .select("*")
        .eq("program_id", programId)
        .order("day_order", { ascending: true }),
      supabase
        .from("program_exercises")
        .select("*, program_days!inner(program_id)")
        .eq("program_days.program_id", programId)
        .order("exercise_order", { ascending: true }),
    ]);

  if (daysError) throw daysError;
  if (exercisesError) throw exercisesError;

  return days.map((day) => ({
    ...day,
    exercises: exercises
      .filter((exercise) => exercise.program_day_id === day.id),
  }));
}

export async function createProgram(input) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("workout_programs")
    .insert({
      owner_id: ownerId,
      trainee_id: input.trainee_id,
      name: input.name,
      goal: input.goal ?? null,
      status: "draft",
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      notes: input.notes ?? null,
      duration_weeks: input.duration_weeks ?? null,
      sessions_per_week: input.sessions_per_week ?? null,
      is_template: input.is_template ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProgram(id, input) {
  const { data, error } = await supabase
    .from("workout_programs")
    .update({
      trainee_id: input.trainee_id,
      name: input.name,
      goal: input.goal ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      notes: input.notes ?? null,
      duration_weeks: input.duration_weeks ?? null,
      sessions_per_week: input.sessions_per_week ?? null,
      is_template: input.is_template ?? false,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function activateProgram(id) {
  const { error } = await supabase.rpc("activate_workout_program", {
    p_program_id: id,
  });

  if (error) throw error;

  const { data, error: fetchError } = await supabase
    .from("workout_programs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  return data;
}

export async function deleteProgram(id) {
  const { error } = await supabase
    .from("workout_programs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function createProgramDay(input) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("program_days")
    .insert({
      owner_id: ownerId,
      program_id: input.program_id,
      name: input.name,
      day_order: input.day_order,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProgramDay(id, input) {
  const { data, error } = await supabase
    .from("program_days")
    .update({
      name: input.name,
      day_order: input.day_order,
      notes: input.notes ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProgramDay(id) {
  const { error } = await supabase.from("program_days").delete().eq("id", id);
  if (error) throw error;
}

export async function createProgramExercise(input) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("program_exercises")
    .insert({
      owner_id: ownerId,
      program_day_id: input.program_day_id,
      name: input.name,
      exercise_order: input.exercise_order,
      sets: input.sets,
      reps: input.reps,
      target_rir: input.target_rir ?? null,
      rest_seconds: input.rest_seconds ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProgramExercise(id, input) {
  const { data, error } = await supabase
    .from("program_exercises")
    .update({
      name: input.name,
      exercise_order: input.exercise_order,
      sets: input.sets,
      reps: input.reps,
      target_rir: input.target_rir ?? null,
      rest_seconds: input.rest_seconds ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProgramExercise(id) {
  const { error } = await supabase
    .from("program_exercises")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
