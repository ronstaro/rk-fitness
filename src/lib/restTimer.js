// Smart rest timer of the live workout: rest between the sets of one
// exercise, and between the rounds of a superset / triple set. It is guidance
// only: nothing in the workout waits for it or is disabled by it.
//
// The timer is an end timestamp, never a counter, so a backgrounded tab, a
// locked phone or a refresh still shows the right time. It lives in React
// state plus a small localStorage copy; it is not stored in the database.

import { GROUP_LETTERS, buildRoundUnits, groupLabel, groupRestSeconds, roundProgress } from "./exerciseGroups.js";

export const DEFAULT_REST_SECONDS = 90;
export const REST_PRESETS = [45, 60, 90, 120, 180];
export const MAX_REST_SECONDS = 600;
export const ADD_REST_SECONDS = 30;
// How long the "rest is over" state stays before it goes away by itself.
export const DONE_VISIBLE_MS = 8000;

const STORAGE_KEY = "rk-rest-timer";

// Exercises saved before the timer existed have no rest; they rest 90 s.
export function effectiveRestSeconds(value) {
  if (value == null || value === "") return DEFAULT_REST_SECONDS;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_REST_SECONDS;
}

// A logged block runs for its saved set rows, the same units the live screen shows.
function liveUnits(exercises) {
  return buildRoundUnits(exercises, (exercise) => exercise.sets.length);
}

// What should happen right after `setId` of `exerciseId` became completed.
// `exercises` is the live workout with that set already completed. Returns
// null when no rest follows (the last set of an exercise, a member that is
// not the last of its round, the last round, or a rest of 0), otherwise the
// rest to show.
export function restAfterCompletion(exercises, exerciseId, setId) {
  const unit = liveUnits(exercises).find((item) =>
    item.exercises.some((exercise) => exercise.id === exerciseId)
  );
  if (!unit) return null;

  if (unit.type !== "group") {
    const exercise = unit.exercises[0];
    const done = exercise.sets.find((set) => set.id === setId);
    const next = exercise.sets.find((set) => !set.is_completed);
    const seconds = effectiveRestSeconds(exercise.rest_seconds);
    if (!done || !next || seconds <= 0) return null;
    const total = exercise.sets.length;
    return {
      kind: "sets",
      seconds,
      exerciseId,
      setId,
      nextSetId: next.id,
      title: "מנוחה בין סטים",
      doneLabel: `${exercise.exercise_name} · סט ${done.set_order} מתוך ${total} הושלם`,
      nextLabel: `${exercise.exercise_name} · סט ${next.set_order} מתוך ${total}`,
      members: [],
    };
  }

  const member = unit.exercises.find((exercise) => exercise.id === exerciseId);
  const round = member.sets.findIndex((set) => set.id === setId) + 1;
  if (round < 1) return null;
  // Inside a round the next member follows at once; rest only ends a round.
  const roundDone = unit.exercises.every((exercise) => exercise.sets[round - 1]?.is_completed);
  if (!roundDone) return null;
  const { currentRound, nextExerciseId } = roundProgress(unit);
  const seconds = effectiveRestSeconds(groupRestSeconds(unit));
  if (currentRound == null || seconds <= 0) return null;
  const nextIndex = unit.exercises.findIndex((exercise) => exercise.id === nextExerciseId);
  const nextExercise = unit.exercises[nextIndex];
  return {
    kind: "rounds",
    seconds,
    exerciseId,
    setId,
    nextSetId: nextExercise.sets[currentRound - 1]?.id ?? null,
    title: "מנוחה בין סבבים",
    doneLabel: `${groupLabel(unit.exercises.length)} · סבב ${round} מתוך ${unit.rounds} הושלם`,
    nextLabel: `סבב ${currentRound} · ${GROUP_LETTERS[nextIndex]} · ${nextExercise.exercise_name}`,
    members: unit.exercises.map((exercise, index) => `${GROUP_LETTERS[index]} · ${exercise.exercise_name}`),
  };
}

// The live workout with one set's completion changed, as the timer sees it.
export function withSetCompletion(exercises, exerciseId, setId, isCompleted) {
  return exercises.map((exercise) =>
    exercise.id === exerciseId
      ? {
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId ? { ...set, is_completed: isCompleted } : set)),
        }
      : exercise
  );
}

export function startRest(plan, workoutLogId, now = Date.now()) {
  return { ...plan, workoutLogId, durationMs: plan.seconds * 1000, endsAt: now + plan.seconds * 1000 };
}

// +30 s counts from the current end, or from now once the rest is over.
export function extendRest(timer, now = Date.now(), seconds = ADD_REST_SECONDS) {
  const endsAt = Math.max(timer.endsAt, now) + seconds * 1000;
  return { ...timer, endsAt, durationMs: Math.max(timer.durationMs, endsAt - now) };
}

export function restRemainingMs(timer, now = Date.now()) {
  return Math.max(0, timer.endsAt - now);
}

// Running, then the short "rest is over" state, then gone.
export function restPhase(timer, now = Date.now()) {
  if (!timer) return "none";
  if (now < timer.endsAt) return "running";
  if (now < timer.endsAt + DONE_VISIBLE_MS) return "done";
  return "none";
}

export function formatRestClock(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Only ids and times are kept on the device; names are rebuilt from the
// workout when the timer is restored.
export function saveStoredRest(timer) {
  try {
    if (!timer) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const { workoutLogId, exerciseId, setId, endsAt, durationMs } = timer;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ workoutLogId, exerciseId, setId, endsAt, durationMs }));
  } catch {
    // Storage can be blocked (private mode); the timer still works until a refresh.
  }
}

function readStoredRest() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return null;
    const { workoutLogId, exerciseId, setId, endsAt, durationMs } = value;
    const valid = [workoutLogId, exerciseId, setId].every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)
      && Number.isFinite(endsAt) && Number.isFinite(durationMs);
    return valid ? { workoutLogId, exerciseId, setId, endsAt, durationMs } : null;
  } catch {
    return null;
  }
}

// The saved timer of this open workout, if it still applies: its set is still
// completed and it would still lead to a rest. Anything else is dropped.
export function restoreRest(workout, now = Date.now()) {
  const stored = readStoredRest();
  if (!stored) return null;
  const exercise = workout?.exercises.find((item) => item.id === stored.exerciseId);
  const set = exercise?.sets.find((item) => item.id === stored.setId);
  const plan = set?.is_completed && stored.workoutLogId === workout.id
    ? restAfterCompletion(workout.exercises, stored.exerciseId, stored.setId)
    : null;
  const timer = plan ? { ...plan, workoutLogId: workout.id, endsAt: stored.endsAt, durationMs: stored.durationMs } : null;
  if (!timer || restPhase(timer, now) === "none") {
    saveStoredRest(null);
    return null;
  }
  return timer;
}
