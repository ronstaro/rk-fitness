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

async function attachWorkoutDetails(workouts) {
  if (workouts.length === 0) return [];

  const workoutIds = workouts.map((workout) => workout.id);
  const { data: exercises, error: exercisesError } = await supabase
    .from("workout_log_exercises")
    .select("id, workout_log_id, exercise_order, exercise_name, prescribed_sets, prescribed_reps, target_weight_kg, target_rir, rest_seconds, trainer_notes, trainee_notes, is_completed, video_path, video_uploaded_at, trainer_feedback")
    .in("workout_log_id", workoutIds)
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

  return workouts.map((workout) => ({
    ...workout,
    exercises: exercisesWithVideos
      .filter((exercise) => exercise.workout_log_id === workout.id)
      .map((exercise) => ({
        ...exercise,
        sets: sets.filter((set) => set.workout_log_exercise_id === exercise.id),
      })),
  }));
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
    .select("id, workout_log_id, exercise_order, exercise_name, prescribed_sets, prescribed_reps, target_weight_kg, target_rir, rest_seconds, trainer_notes, trainee_notes, is_completed, video_path, video_uploaded_at, source_program_exercise_id")
    .eq("workout_log_id", workout.id)
    .order("exercise_order", { ascending: true });

  if (exercisesError) throw exercisesError;

  // The trainer's demo video (YouTube link, or an older uploaded file) stays
  // on the program exercise; a missing one only hides the button.
  const sourceIds = [
    ...new Set((exercises ?? []).map((exercise) => exercise.source_program_exercise_id).filter(Boolean)),
  ];
  const demoVideos = new Map();
  if (sourceIds.length > 0) {
    const { data: programExercises, error: demoError } = await supabase
      .from("program_exercises")
      .select("id, demo_video_path, demo_video_url")
      .in("id", sourceIds)
      .or("demo_video_path.not.is.null,demo_video_url.not.is.null");

    if (demoError) {
      console.error("Demo videos load error:", demoError);
    } else {
      for (const row of programExercises ?? []) {
        demoVideos.set(row.id, row);
      }
    }
  }

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
      demo_video_path: demoVideos.get(exercise.source_program_exercise_id)?.demo_video_path ?? null,
      demo_video_url: demoVideos.get(exercise.source_program_exercise_id)?.demo_video_url ?? null,
      sets: sets.filter((set) => set.workout_log_exercise_id === exercise.id),
    })),
  };
}

export async function fetchCompletedWorkouts({ traineeId, limit = 50 } = {}) {
  let query = supabase
    .from("workout_logs")
    .select("id, trainee_id, program_name, program_goal, day_name, day_order, status, started_at, completed_at, trainer_feedback, trainer_reviewed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (traineeId) {
    query = query.eq("trainee_id", traineeId);
  }

  const { data: workouts, error } = await query;
  if (error) throw error;

  return attachWorkoutDetails(workouts ?? []);
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

// Saves the whole review at once. The server sets the reviewer and time, and
// an empty text clears that feedback.
export async function saveWorkoutReview(workoutId, generalFeedback, exerciseFeedback) {
  const { data, error } = await supabase.rpc("save_workout_review", {
    p_workout_id: workoutId,
    p_general_feedback: generalFeedback ?? "",
    p_exercise_feedback: exerciseFeedback.map(({ id, feedback }) => ({ id, feedback: feedback ?? "" })),
  });

  if (error) throw error;
  return data;
}
