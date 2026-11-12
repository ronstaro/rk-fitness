// Focus mode of the trainee live workout: which exercise or block is open,
// which set is next, and the short summaries shown for collapsed parts.
// Pure helpers only (no React, no Supabase); every answer comes from the
// saved sets, so a refresh lands on the same place.

import { GROUP_LETTERS } from "./exerciseGroups.js";

// An exercise counts as done when the trainee once marked it by hand (the old
// manual button, kept for workouts logged before it was removed) or when all
// of its sets are recorded. Nothing writes the stored flag any more.
export function isExerciseDone(exercise) {
  if (exercise.is_completed) return true;
  return exercise.sets.length > 0 && exercise.sets.every((workoutSet) => workoutSet.is_completed);
}

export function unitKey(unit) {
  return unit.type === "group" ? `g:${unit.groupId}` : `e:${unit.exercises[0].id}`;
}

export function isUnitDone(unit) {
  return unit.exercises.every(isExerciseDone);
}

// The unit that opens by itself: the first one that is not done yet.
export function autoFocusUnitKey(units) {
  const unit = units.find((item) => !isUnitDone(item));
  return unit ? unitKey(unit) : null;
}

export function currentSetId(exercise) {
  return exercise.sets.find((workoutSet) => !workoutSet.is_completed)?.id ?? null;
}

export function unitSetCounts(unit) {
  const sets = unit.exercises.flatMap((exercise) => exercise.sets);
  return { done: sets.filter((workoutSet) => workoutSet.is_completed).length, total: sets.length };
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

// "50×10", "50 ק״ג" or "10 חז׳"; null when nothing was entered.
export function resultPair(weight, reps) {
  const hasWeight = hasValue(weight);
  const hasReps = hasValue(reps);
  if (hasWeight && hasReps) return `${Number(weight)}×${Number(reps)}`;
  if (hasWeight) return `${Number(weight)} ק״ג`;
  if (hasReps) return `${Number(reps)} חז׳`;
  return null;
}

// Last time's result of an exercise: one pair per set that has one, and
// `repeated` (the number of sets) when every pair is the same, so the screen
// can show "47.5×9 · 3 סטים" instead of the same pair three times.
export function previousSummary(exercise) {
  const pairs = exercise.sets
    .map((workoutSet) => resultPair(workoutSet.previous_weight_kg, workoutSet.previous_reps))
    .filter(Boolean);
  if (pairs.length > 1 && pairs.every((pair) => pair === pairs[0])) {
    return { pairs: [pairs[0]], repeated: pairs.length };
  }
  return { pairs, repeated: 0 };
}

// One finished round of a block: "A 35×12", "B 15×15".
export function roundSummary(unit, round) {
  return unit.exercises.map((exercise, index) => {
    const workoutSet = exercise.sets[round - 1];
    const pair = workoutSet ? resultPair(workoutSet.weight_kg, workoutSet.completed_reps) : null;
    return `${GROUP_LETTERS[index]} ${pair ?? "✓"}`;
  });
}

// The heaviest recorded weight of an exercise, for its collapsed row.
export function topWeight(exercise) {
  const weights = exercise.sets
    .filter((workoutSet) => workoutSet.is_completed && hasValue(workoutSet.weight_kg))
    .map((workoutSet) => Number(workoutSet.weight_kg));
  return weights.length ? Math.max(...weights) : null;
}
