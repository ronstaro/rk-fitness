import { supabase } from "../lib/supabase.js";
import { getBusinessOwnerId } from "./accessService.js";

const DEMO_VIDEO_BUCKET = "exercise-demo-videos";

// Removes demo video files that no exercise points to any more. Storage
// cleanup is best effort: a leftover file is private and harmless.
async function removeUnusedDemoVideos(paths) {
  const candidates = [...new Set(paths.filter(Boolean))];
  if (candidates.length === 0) return;

  const { data: stillUsed, error } = await supabase
    .from("program_exercises")
    .select("demo_video_path")
    .in("demo_video_path", candidates);
  if (error) return;

  const used = new Set((stillUsed ?? []).map((row) => row.demo_video_path));
  const unused = candidates.filter((path) => !used.has(path));
  if (unused.length > 0) {
    await supabase.storage.from(DEMO_VIDEO_BUCKET).remove(unused);
  }
}

async function demoVideoPathsForDays(dayIds) {
  if (dayIds.length === 0) return [];
  const { data, error } = await supabase
    .from("program_exercises")
    .select("demo_video_path")
    .in("program_day_id", dayIds)
    .not("demo_video_path", "is", null);
  if (error) throw error;
  return (data ?? []).map((row) => row.demo_video_path);
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
  const ownerId = await getBusinessOwnerId();
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
  const { data: programDays, error: daysError } = await supabase
    .from("program_days")
    .select("id")
    .eq("program_id", id);
  if (daysError) throw daysError;
  const videoPaths = await demoVideoPathsForDays(
    (programDays ?? []).map((day) => day.id)
  );

  const { error } = await supabase
    .from("workout_programs")
    .delete()
    .eq("id", id);

  if (error) throw error;  await removeUnusedDemoVideos(videoPaths);
}

export async function createProgramDay(input) {
  const ownerId = await getBusinessOwnerId();
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
  const videoPaths = await demoVideoPathsForDays([id]);
  const { error } = await supabase.from("program_days").delete().eq("id", id);
  if (error) throw error;
  await removeUnusedDemoVideos(videoPaths);
}

export async function createProgramExercise(input) {
  const ownerId = await getBusinessOwnerId();
  const { data, error } = await supabase
    .from("program_exercises")
    .insert({
      owner_id: ownerId,
      program_day_id: input.program_day_id,
      name: input.name,
      exercise_order: input.exercise_order,
      sets: input.sets,
      reps: input.reps,
      target_weight_kg: input.target_weight_kg ?? null,
      target_rir: input.target_rir ?? null,
      rest_seconds: input.rest_seconds ?? null,
      notes: input.notes ?? null,
      demo_video_url: input.demo_video_url ?? null,
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
      target_weight_kg: input.target_weight_kg ?? null,
      target_rir: input.target_rir ?? null,
      rest_seconds: input.rest_seconds ?? null,
      notes: input.notes ?? null,
      demo_video_url: input.demo_video_url ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProgramExercise(id) {
  const { data: deleted, error } = await supabase
    .from("program_exercises")
    .delete()
    .eq("id", id)
    .select("demo_video_path");

  if (error) throw error;
  await removeUnusedDemoVideos((deleted ?? []).map((row) => row.demo_video_path));
}

export async function removeExerciseDemoVideo(exercise) {
  const { data, error } = await supabase
    .from("program_exercises")
    .update({ demo_video_path: null, demo_video_uploaded_at: null })
    .eq("id", exercise.id)
    .select()
    .single();

  if (error) throw error;
  await removeUnusedDemoVideos([exercise.demo_video_path]);
  return data;
}

export async function removeExerciseDemoLink(exerciseId) {
  const { data, error } = await supabase
    .from("program_exercises")
    .update({ demo_video_url: null })
    .eq("id", exerciseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// A short-lived link, requested only when someone opens the video.
export async function getExerciseDemoVideoUrl(path) {
  const { data, error } = await supabase.storage
    .from(DEMO_VIDEO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
