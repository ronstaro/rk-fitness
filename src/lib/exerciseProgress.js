// Previous-versus-current comparison of exercises in completed workouts.
// Pure helpers only (no React, no Supabase). Everything is derived from the
// workouts already loaded, so a deleted workout simply stops counting.
//
// Reliability over coverage: when we cannot be sure two exercises are the
// same, or that the numbers can be compared fairly, we show no verdict.

const LRM = "‎";

// Same normalisation as the "previous" lookup of the start-workout function
// (lower + trim), without any fuzzy matching.
export function exerciseNameKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

function positiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Only sets the trainee marked as done, with a real repetition count. Sets
// that were never done still hold the values pre-filled from last time, so
// counting them would invent results.
export function recordedSets(exercise) {
  return (exercise?.sets ?? [])
    .filter((workoutSet) => workoutSet.is_completed)
    .map((workoutSet) => ({
      weight: positiveNumber(workoutSet.weight_kg),
      reps: positiveNumber(workoutSet.completed_reps),
    }))
    .filter((workoutSet) => workoutSet.reps != null);
}

// The heaviest recorded set (most reps among equal weights). An exercise
// without any weight compares by repetitions only; weighted sets win when
// an exercise mixes both.
export function topSet(exercise) {
  const sets = recordedSets(exercise);
  if (sets.length === 0) return null;
  const weighted = sets.filter((workoutSet) => workoutSet.weight != null);
  if (weighted.length > 0) {
    const weight = Math.max(...weighted.map((workoutSet) => workoutSet.weight));
    const reps = Math.max(...weighted.filter((workoutSet) => workoutSet.weight === weight).map((workoutSet) => workoutSet.reps));
    return { weight, reps };
  }
  return { weight: null, reps: Math.max(...sets.map((workoutSet) => workoutSet.reps)) };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// improved | same | lower | mixed | incomparable
// Repetitions are only judged at the same weight. A heavier set counts as an
// improvement only if it did not lose repetitions, and a lighter one as a
// drop only if it did not gain any; anything else is "mixed" (facts, no verdict).
export function compareTopSets(previous, current) {
  if (!previous || !current) return null;
  if ((previous.weight == null) !== (current.weight == null)) {
    return { kind: "incomparable", weightDelta: null, repsDelta: null };
  }
  const repsDelta = current.reps - previous.reps;
  if (previous.weight == null) {
    return { kind: repsDelta > 0 ? "improved" : repsDelta < 0 ? "lower" : "same", weightDelta: null, repsDelta };
  }
  const weightDelta = round2(current.weight - previous.weight);
  if (weightDelta === 0) {
    return { kind: repsDelta > 0 ? "improved" : repsDelta < 0 ? "lower" : "same", weightDelta, repsDelta };
  }
  if (weightDelta > 0) return { kind: repsDelta >= 0 ? "improved" : "mixed", weightDelta, repsDelta };
  return { kind: repsDelta <= 0 ? "lower" : "mixed", weightDelta, repsDelta };
}

function sameSource(a, b) {
  return Boolean(a.source_program_exercise_id) && a.source_program_exercise_id === b.source_program_exercise_id;
}

// The previous time this trainee did this exercise, or null.
// - Only the same trainee, and only workouts completed before this one.
// - The name must match exactly (after lower + trim). A shared program
//   exercise id alone is not enough, because an exercise renamed in place
//   may be a different movement.
// - A workout that holds the name twice is skipped, and so is the whole
//   comparison when the current workout holds it twice (ambiguous).
// - An occurrence without any recorded set is skipped (exercise not done).
// - Like the start-workout lookup, the same program exercise wins over a
//   more recent one from another program; then the most recent wins.
export function findPreviousOccurrence(workouts, workout, exercise) {
  const key = exerciseNameKey(exercise.exercise_name);
  if (!key) return null;
  if ((workout.exercises ?? []).filter((item) => exerciseNameKey(item.exercise_name) === key).length !== 1) return null;
  const completedAt = new Date(workout.completed_at).getTime();
  if (!Number.isFinite(completedAt)) return null;

  const candidates = [];
  for (const other of workouts) {
    if (other.id === workout.id || other.trainee_id !== workout.trainee_id) continue;
    const otherAt = new Date(other.completed_at).getTime();
    if (!Number.isFinite(otherAt) || otherAt >= completedAt) continue;
    const matches = (other.exercises ?? []).filter((item) => exerciseNameKey(item.exercise_name) === key);
    if (matches.length !== 1) continue;
    const top = topSet(matches[0]);
    if (!top) continue;
    candidates.push({ workout: other, exercise: matches[0], top, at: otherAt, preferred: sameSource(matches[0], exercise) });
  }
  candidates.sort((a, b) => (Number(b.preferred) - Number(a.preferred)) || (b.at - a.at));
  const best = candidates[0];
  return best ? { workout: best.workout, exercise: best.exercise, top: best.top } : null;
}

// Per workout: { exercises: { [exerciseId]: { previous, current, result } }, improved, lower }.
// Exercises with nothing comparable are left out, so the screen shows no line.
export function buildWorkoutComparisons(workouts) {
  const byTrainee = new Map();
  for (const workout of workouts) {
    if (!byTrainee.has(workout.trainee_id)) byTrainee.set(workout.trainee_id, []);
    byTrainee.get(workout.trainee_id).push(workout);
  }

  const comparisons = new Map();
  for (const workout of workouts) {
    const sameTrainee = byTrainee.get(workout.trainee_id) ?? [];
    const exercises = {};
    let improved = 0;
    let lower = 0;
    for (const exercise of workout.exercises ?? []) {
      const current = topSet(exercise);
      if (!current) continue;
      const previous = findPreviousOccurrence(sameTrainee, workout, exercise);
      if (!previous) continue;
      const result = compareTopSets(previous.top, current);
      exercises[exercise.id] = { previous, current, result };
      if (result.kind === "improved") improved += 1;
      if (result.kind === "lower") lower += 1;
    }
    comparisons.set(workout.id, { exercises, improved, lower });
  }
  return comparisons;
}

// "80×10", or "45 חזרות" without weight.
export function topSetText(top) {
  if (!top) return "";
  return top.weight == null ? `${top.reps} חזרות` : `${top.weight}×${top.reps}`;
}

function signed(value) {
  return `${LRM}${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}

function repsWord(count) {
  return count === 1 ? "חזרה" : "חזרות";
}

// Short Hebrew tag for a comparison result, or "" when there is no verdict.
export function comparisonTagText(result) {
  if (!result) return "";
  const { kind, weightDelta, repsDelta } = result;
  if (kind === "same") return "= כמו בפעם הקודמת";
  if (kind === "incomparable") return "";
  const parts = [];
  if (weightDelta) parts.push(`${signed(weightDelta)} ק״ג`);
  if (repsDelta && (kind === "mixed" || !weightDelta || (kind === "improved" && repsDelta > 0))) {
    parts.push(`${signed(repsDelta)} ${repsWord(Math.abs(repsDelta))}`);
  }
  const text = parts.join(" · ");
  if (kind === "improved") return `↑ ${text}`;
  if (kind === "lower") return `↓ ${text}`;
  return text;
}
