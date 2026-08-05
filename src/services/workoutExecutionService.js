import { supabase } from "../lib/supabase.js";

const WORKOUT_VIDEO_BUCKET = "workout-videos";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

function nullableNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function fetchOpenWorkout(traineeId) {
  const { data: workout, error: workoutError } = await supabase
    .from("workout_logs")
    .select("id, trainee_id, program_name, program_goal, day_name, day_order, status, started_at")
    .eq("trainee_id", traineeId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (workoutError) throw workoutError;
  if (!workout) return null;

  const { data: exercises, error: exercisesError } = await supabase
    .from("workout_log_exercises")
    .select("id, workout_log_id, exercise_order, exercise_name, prescribed_sets, prescribed_reps, target_weight_kg, target_rir, rest_seconds, trainer_notes, trainee_notes, is_completed, video_path, video_uploaded_at")
    .eq("workout_log_id", workout.id)
    .order("exercise_order", { ascending: true });

  if (exercisesError) throw exercisesError;

  const exerciseIds = (exercises ?? []).map((exercise) => exercise.id);
  let sets = [];

  if (exerciseIds.length > 0) {
    const { data: setRows, error: setsError } = await supabase
      .from("workout_log_sets")
      .select("id, workout_log_exercise_id, set_order, weight_kg, completed_reps, rir, previous_weight_kg, previous_reps, previous_rir, is_completed")
      .in("workout_log_exercise_id", exerciseIds)
      .order("set_order", { ascending: true });

    if (setsError) throw setsError;
    sets = setRows ?? [];
  }

  const exercisesWithVideos = await Promise.all(
    (exercises ?? []).map(async (exercise) => {
      if (!exercise.video_path) return { ...exercise, video_url: null };

      const { data } = await supabase.storage
        .from(WORKOUT_VIDEO_BUCKET)
        .createSignedUrl(exercise.video_path, 60 * 60);

      return { ...exercise, video_url: data?.signedUrl ?? null };
    })
  );

  return {
    ...workout,
    exercises: exercisesWithVideos.map((exercise) => ({
      ...exercise,
      sets: sets.filter((set) => set.workout_log_exercise_id === exercise.id),
    })),
  };
}

export async function startWorkout(programDayId) {
  const { data, error } = await supabase.rpc("start_my_workout", {
    p_program_day_id: programDayId,
  });

  if (error) throw error;
  return data;
}

export async function updateWorkoutSet(setId, changes) {
  const payload = {};

  if (Object.hasOwn(changes, "weight_kg")) {
    payload.weight_kg = nullableNumber(changes.weight_kg);
  }
  if (Object.hasOwn(changes, "completed_reps")) {
    payload.completed_reps = nullableNumber(changes.completed_reps);
  }
  if (Object.hasOwn(changes, "rir")) {
    payload.rir = nullableNumber(changes.rir);
  }
  if (Object.hasOwn(changes, "is_completed")) {
    payload.is_completed = Boolean(changes.is_completed);
  }

  const { data, error } = await supabase
    .from("workout_log_sets")
    .update(payload)
    .eq("id", setId)
    .select("id, weight_kg, completed_reps, rir, previous_weight_kg, previous_reps, previous_rir, is_completed")
    .single();

  if (error) throw error;
  return data;
}

export async function uploadExerciseVideo({
  traineeId,
  workoutId,
  exerciseId,
  file,
  previousPath,
}) {
  if (!file || !Object.hasOwn(VIDEO_EXTENSIONS, file.type)) {
    throw new Error("unsupported-video");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("video-too-large");
  }

  const extension = VIDEO_EXTENSIONS[file.type];
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${traineeId}/${exerciseId}/${workoutId}-${uniqueId}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(WORKOUT_VIDEO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: savedExercise, error: updateError } = await supabase
    .from("workout_log_exercises")
    .update({ video_path: path, video_uploaded_at: new Date().toISOString() })
    .eq("id", exerciseId)
    .eq("workout_log_id", workoutId)
    .select("id, video_path, video_uploaded_at")
    .single();

  if (updateError) {
    await supabase.storage.from(WORKOUT_VIDEO_BUCKET).remove([path]);
    throw updateError;
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from(WORKOUT_VIDEO_BUCKET).remove([previousPath]);
  }

  const { data: signedUrlData } = await supabase.storage
    .from(WORKOUT_VIDEO_BUCKET)
    .createSignedUrl(path, 60 * 60);

  return {
    ...savedExercise,
    video_url: signedUrlData?.signedUrl ?? null,
  };
}

export async function updateWorkoutExercise(exerciseId, changes) {
  const payload = {};

  if (Object.hasOwn(changes, "trainee_notes")) {
    payload.trainee_notes = changes.trainee_notes?.trim() || null;
  }
  if (Object.hasOwn(changes, "is_completed")) {
    payload.is_completed = Boolean(changes.is_completed);
  }

  const { data, error } = await supabase
    .from("workout_log_exercises")
    .update(payload)
    .eq("id", exerciseId)
    .select("id, trainee_notes, is_completed")
    .single();

  if (error) throw error;
  return data;
}

export async function finishWorkout(workoutId) {
  const { error } = await supabase.rpc("finish_my_workout", {
    p_workout_id: workoutId,
  });

  if (error) throw error;
}
