// Superset / triple set blocks (migration 029).
//
// Consecutive exercises of one workout type that share an exercise_group_id
// are one block: 2 = superset, 3 = triple set. Neither the type nor the number
// of rounds is stored: the type is the member count and the rounds are the
// members' own `sets`, which the editor keeps equal. Anything that does not
// form a valid block (a single member, more than 3, or members that are not
// next to each other) is shown and executed as standalone exercises, so a
// half-saved change can never break a workout.

export const MAX_GROUP_SIZE = 3;

export const GROUP_LABELS = {
  2: "סופר סט",
  3: "טריפל סט",
};

export function groupLabel(size) {
  return GROUP_LABELS[size] || "";
}

// Rounds of a block. Members normally share one `sets` value; if they ever
// differ, the block runs for the largest one and a shorter member simply has
// no set in the last rounds.
export function groupRounds(members) {
  return members.reduce((max, member) => Math.max(max, Number(member.sets) || 0), 0);
}

// Splits a day's exercises (already sorted by exercise_order) into units:
// { type: "single", exercises: [exercise] } or
// { type: "group", groupId, exercises: [2-3 members], rounds }.
export function buildExerciseUnits(exercises, groupKey = "exercise_group_id") {
  const runs = [];
  for (const exercise of exercises) {
    const groupId = exercise[groupKey] || null;
    const last = runs[runs.length - 1];
    if (groupId && last && last.groupId === groupId) {
      last.exercises.push(exercise);
    } else {
      runs.push({ groupId, exercises: [exercise] });
    }
  }

  const runsPerGroup = new Map();
  for (const run of runs) {
    if (run.groupId) runsPerGroup.set(run.groupId, (runsPerGroup.get(run.groupId) || 0) + 1);
  }

  return runs.flatMap((run) => {
    const valid =
      run.groupId &&
      runsPerGroup.get(run.groupId) === 1 &&
      run.exercises.length >= 2 &&
      run.exercises.length <= MAX_GROUP_SIZE;
    if (!valid) {
      return run.exercises.map((exercise) => ({ type: "single", exercises: [exercise] }));
    }
    return [{
      type: "group",
      groupId: run.groupId,
      exercises: run.exercises,
      rounds: groupRounds(run.exercises),
    }];
  });
}

// The block an exercise belongs to, or null when it is standalone.
export function findExerciseGroup(exercises, exerciseId) {
  return (
    buildExerciseUnits(exercises).find(
      (unit) => unit.type === "group" && unit.exercises.some((item) => item.id === exerciseId)
    ) || null
  );
}

export function canLinkUnits(upper, lower) {
  return Boolean(upper && lower) && upper.exercises.length + lower.exercises.length <= MAX_GROUP_SIZE;
}

function changesFor(members, groupId, sets) {
  return members
    .filter(
      (member) =>
        (member.exercise_group_id || null) !== groupId ||
        (sets != null && member.sets !== sets)
    )
    .map((member) => ({
      id: member.id,
      exercise_group_id: groupId,
      sets: sets ?? member.sets,
      previous_group_id: member.exercise_group_id || null,
      previous_sets: member.sets,
    }));
}

// Joins two neighbouring units into one block. An existing block keeps its id
// and its rounds; two standalone exercises take the upper one's sets.
export function planLink(upper, lower, newId) {
  if (!canLinkUnits(upper, lower)) return null;
  const members = [...upper.exercises, ...lower.exercises];
  const existing = [upper, lower].find((unit) => unit.type === "group");
  const groupId = existing ? existing.groupId : newId;
  const rounds = existing ? existing.rounds : upper.exercises[0].sets;
  return {
    groupId,
    rounds,
    members,
    roundsChange: members.some((member) => member.sets !== rounds),
    changes: changesFor(members, groupId, rounds),
  };
}

// Cuts a block between member `afterIndex` and the next one. A part of two
// stays a superset (keeping the block's id), a part of one becomes standalone.
export function planUnlink(unit, afterIndex) {
  const left = unit.exercises.slice(0, afterIndex + 1);
  const right = unit.exercises.slice(afterIndex + 1);
  return [
    ...changesFor(left, left.length >= 2 ? unit.groupId : null, null),
    ...changesFor(right, right.length >= 2 ? unit.groupId : null, null),
  ];
}

// Every member becomes standalone; sets, rest and everything else stay.
export function planUngroup(unit) {
  return changesFor(unit.exercises, null, null);
}

// New exercise_order values for a day whose exercises take the order of
// `orderedIds`. With distinct, increasing orders the existing values are
// handed out again (a swap of two rows changes only those two); with ties or
// an unsorted day every row is renumbered 1..n.
export function planOrder(exercises, orderedIds) {
  const strictlyIncreasing = exercises.every(
    (item, index) => index === 0 || item.exercise_order > exercises[index - 1].exercise_order
  );
  const values = strictlyIncreasing
    ? exercises.map((item) => item.exercise_order)
    : exercises.map((_, index) => index + 1);
  const byId = new Map(exercises.map((item) => [item.id, item]));
  const newOrders = new Map(orderedIds.map((id, index) => [id, values[index]]));
  const changes = orderedIds
    .map((id) => byId.get(id))
    .filter((item) => newOrders.get(item.id) !== item.exercise_order)
    .map((item) => ({
      id: item.id,
      exercise_order: newOrders.get(item.id),
      previous_order: item.exercise_order,
    }));
  return { newOrders, changes };
}

// The day's exercise ids after moving one unit (a standalone exercise or a
// whole block) one place up (-1) or down (+1), over the neighbouring unit.
export function moveUnitIds(exercises, unitIndex, direction) {
  const units = buildExerciseUnits(exercises);
  const target = unitIndex + direction;
  if (unitIndex < 0 || unitIndex >= units.length || target < 0 || target >= units.length) {
    return null;
  }
  const moved = [...units];
  [moved[unitIndex], moved[target]] = [moved[target], moved[unitIndex]];
  return moved.flatMap((unit) => unit.exercises.map((item) => item.id));
}

// The day's exercise ids after moving a member inside its own block. A member
// never leaves its block this way.
export function moveMemberIds(exercises, exerciseId, direction) {
  const unit = findExerciseGroup(exercises, exerciseId);
  if (!unit) return null;
  const from = unit.exercises.findIndex((item) => item.id === exerciseId);
  const to = from + direction;
  if (to < 0 || to >= unit.exercises.length) return null;
  const members = [...unit.exercises];
  [members[from], members[to]] = [members[to], members[from]];
  const memberIds = new Set(members.map((item) => item.id));
  let next = 0;
  return exercises.map((item) => (memberIds.has(item.id) ? members[next++].id : item.id));
}

// Copies of a program get their own block ids, so a copy never shares a
// block with its source.
export function remapGroupIds(exercises, makeId) {
  const map = new Map();
  return exercises.map((exercise) => {
    const groupId = exercise.exercise_group_id;
    if (!groupId) return null;
    if (!map.has(groupId)) map.set(groupId, makeId());
    return map.get(groupId);
  });
}

export const GROUP_LETTERS = ["A", "B", "C"];

// Trainee side (program view, live workout, history): a block is run round by
// round, so its members must also have the same number of rounds, at least
// one. A block whose members disagree falls back to standalone exercises,
// which keeps every set reachable exactly as before.
export function buildRoundUnits(exercises, roundsOf) {
  return buildExerciseUnits(exercises).flatMap((unit) => {
    if (unit.type !== "group") return [unit];
    const counts = unit.exercises.map((exercise) => Number(roundsOf(exercise)) || 0);
    if (counts[0] > 0 && counts.every((count) => count === counts[0])) {
      return [{ ...unit, rounds: counts[0] }];
    }
    return unit.exercises.map((exercise) => ({ type: "single", exercises: [exercise] }));
  });
}

// Rest after a round is the last member's rest; the others' rest is kept in
// the data but is not rest between the exercises of a block.
export function groupRestSeconds(unit) {
  return unit.exercises[unit.exercises.length - 1].rest_seconds ?? null;
}

// Where a trainee is in a live block whose members carry their logged `sets`
// (ordered by set_order; round r is each member's r-th set). The current round
// is the first one with an unfinished set and the next exercise is its first
// unfinished member, so a refresh lands on the same spot from the saved data.
export function roundProgress(unit) {
  for (let round = 1; round <= unit.rounds; round += 1) {
    const next = unit.exercises.find((exercise) => {
      const workoutSet = exercise.sets[round - 1];
      return workoutSet && !workoutSet.is_completed;
    });
    if (next) {
      return { currentRound: round, nextExerciseId: next.id, completedRounds: round - 1 };
    }
  }
  return { currentRound: null, nextExerciseId: null, completedRounds: unit.rounds };
}
