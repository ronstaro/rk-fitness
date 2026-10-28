import { supabase } from "../lib/supabase.js";
import { remapGroupIds } from "../lib/exerciseGroups.js";
import { getBusinessOwnerId } from "./accessService.js";

const DEMO_VIDEO_BUCKET = "exercise-demo-videos";
const MAX_DEMO_VIDEO_BYTES = 50 * 1024 * 1024;
const DEMO_VIDEO_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};
export const DEMO_VIDEO_ACCEPT = Object.keys(DEMO_VIDEO_EXTENSIONS).join(",");

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

// Copies a program's structure: every workout type and exercise, with their
// order and targets. Nothing a trainee produced (logs, sets, execution videos,
// feedback) lives in these tables, so none of it is copied. Day ids are made
// here so exercises can be linked without relying on the order rows come back
// in. Each level is one insert; if a later step fails, the new program is
// deleted again (its days and exercises go with it by cascade).
//
// An uploaded demo file is shared, not copied: files are never overwritten in
// place, every removal checks that no other exercise still points to the file,
// and a trainee can read it only through an exercise of their own active
// program.
export async function duplicateProgram(sourceProgramId, input) {
  const sourceDays = await fetchProgramDetails(sourceProgramId);
  const created = await createProgram(input);

  try {
    const dayRows = sourceDays.map((day) => ({
      id: globalThis.crypto.randomUUID(),
      owner_id: created.owner_id,
      program_id: created.id,
      name: day.name,
      day_order: day.day_order,
      notes: day.notes ?? null,
    }));
    const groupIds = remapGroupIds(
      sourceDays.flatMap((day) => day.exercises),
      () => globalThis.crypto.randomUUID()
    );
    let exerciseIndex = 0;
    const exerciseRows = sourceDays.flatMap((day, index) =>
      day.exercises.map((exercise) => ({
        owner_id: created.owner_id,
        program_day_id: dayRows[index].id,
        name: exercise.name,
        exercise_order: exercise.exercise_order,
        sets: exercise.sets,
        reps: exercise.reps,
        target_weight_kg: exercise.target_weight_kg ?? null,
        target_rir: exercise.target_rir ?? null,
        rest_seconds: exercise.rest_seconds ?? null,
        notes: exercise.notes ?? null,
        demo_video_url: exercise.demo_video_url ?? null,
        demo_video_path: exercise.demo_video_path ?? null,
        demo_video_uploaded_at: exercise.demo_video_path
          ? exercise.demo_video_uploaded_at
          : null,
        exercise_group_id: groupIds[exerciseIndex++],
      }))
    );

    if (dayRows.length > 0) {
      const { error } = await supabase.from("program_days").insert(dayRows);
      if (error) throw error;
    }
    if (exerciseRows.length > 0) {
      const { error } = await supabase.from("program_exercises").insert(exerciseRows);
      if (error) throw error;
    }
  } catch (error) {
    // Plain delete: the shared demo files still belong to the source program.
    await supabase.from("workout_programs").delete().eq("id", created.id);
    throw error;
  }

  return { ...created, days_count: sourceDays.length };
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

// An exercise has one demo source at a time. demo_video_url is changed only
// when the input names it, and clear_demo_file drops an uploaded file in the
// same update, so a link never sits next to a file.
export async function updateProgramExercise(id, input) {
  const changes = {
    name: input.name,
    exercise_order: input.exercise_order,
    sets: input.sets,
    reps: input.reps,
    target_weight_kg: input.target_weight_kg ?? null,
    target_rir: input.target_rir ?? null,
    rest_seconds: input.rest_seconds ?? null,
    notes: input.notes ?? null,
  };
  if (Object.hasOwn(input, "demo_video_url")) {
    changes.demo_video_url = input.demo_video_url;
  }
  if (input.clear_demo_file) {
    changes.demo_video_path = null;
    changes.demo_video_uploaded_at = null;
  }

  const { data, error } = await supabase
    .from("program_exercises")
    .update(changes)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (input.clear_demo_file) await removeUnusedDemoVideos([input.previous_demo_video_path]);
  return data;
}

async function setExerciseOrder(id, exerciseOrder) {
  const { error } = await supabase
    .from("program_exercises")
    .update({ exercise_order: exerciseOrder })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}

// Changes only exercise_order, one row at a time (there is no unique
// constraint on the order, so a brief tie in between is harmless). If a step
// fails, the rows already changed get their old order back.
export async function reorderProgramExercises(changes) {
  const done = [];
  try {
    for (const change of changes) {
      await setExerciseOrder(change.id, change.exercise_order);
      done.push(change);
    }
  } catch (error) {
    for (const change of done.reverse()) {
      await setExerciseOrder(change.id, change.previous_order).catch(() => {});
    }
    throw error;
  }
}

async function setExerciseGroup(id, exerciseGroupId, sets) {
  const { data, error } = await supabase
    .from("program_exercises")
    .update({ exercise_group_id: exerciseGroupId, sets })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Creates, changes or breaks a superset / triple set block: each change sets
// one exercise's exercise_group_id and sets (the block's rounds). Rows are
// updated one at a time; if a step fails, the rows already changed get their
// old values back.
export async function applyExerciseGroupChanges(changes) {
  const done = [];
  const saved = [];
  try {
    for (const change of changes) {
      saved.push(await setExerciseGroup(change.id, change.exercise_group_id, change.sets));
      done.push(change);
    }
  } catch (error) {
    for (const change of done.reverse()) {
      await setExerciseGroup(change.id, change.previous_group_id, change.previous_sets).catch(() => {});
    }
    throw error;
  }
  return saved;
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

export function validateExerciseDemoVideo(file) {
  if (!file || !Object.hasOwn(DEMO_VIDEO_EXTENSIONS, file.type)) {
    throw new Error("unsupported-video");
  }
  if (file.size > MAX_DEMO_VIDEO_BYTES) {
    throw new Error("video-too-large");
  }
}

// Uploads a file as the exercise's demo. The same update clears an external
// link, so the file becomes the only demo source.
export async function uploadExerciseDemoVideo(exercise, file) {
  validateExerciseDemoVideo(file);

  const ownerId = await getBusinessOwnerId();
  const path = `${ownerId}/${globalThis.crypto.randomUUID()}.${DEMO_VIDEO_EXTENSIONS[file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from(DEMO_VIDEO_BUCKET)
    .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("program_exercises")
    .update({
      demo_video_path: path,
      demo_video_uploaded_at: new Date().toISOString(),
      demo_video_url: null,
    })
    .eq("id", exercise.id)
    .select()
    .single();

  if (error) {
    await supabase.storage.from(DEMO_VIDEO_BUCKET).remove([path]);
    throw error;
  }

  await removeUnusedDemoVideos([exercise.demo_video_path]);
  return data;
}

// Removes the exercise's demo, whichever source it is.
export async function removeExerciseDemo(exercise) {
  const { data, error } = await supabase
    .from("program_exercises")
    .update({ demo_video_path: null, demo_video_uploaded_at: null, demo_video_url: null })
    .eq("id", exercise.id)
    .select()
    .single();

  if (error) throw error;
  await removeUnusedDemoVideos([exercise.demo_video_path]);
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
