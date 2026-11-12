// A trainee may hold several active programs at once (strength, cardio,
// mobility...). These helpers keep every screen on the same rules: programs
// stay separate, and the weekly target is the sum of their weekly targets.

// Active programs grouped per trainee, in the order the query returned them.
export function groupProgramsByTrainee(programs) {
  const grouped = {};
  for (const program of programs ?? []) {
    if (!grouped[program.trainee_id]) grouped[program.trainee_id] = [];
    grouped[program.trainee_id].push(program);
  }
  return grouped;
}

// Total weekly target across programs; a program without a target adds 0.
export function weeklyTargetOf(programs) {
  return (programs ?? []).reduce((sum, program) => {
    const target = Number(program?.sessions_per_week);
    return Number.isFinite(target) && target > 0 ? sum + target : sum;
  }, 0);
}

// Completed workouts per source program; workouts whose program is gone or
// unknown still count in the weekly total, just not on a program card.
export function countWorkoutsByProgram(workouts) {
  const counts = {};
  for (const workout of workouts ?? []) {
    if (!workout.source_program_id) continue;
    counts[workout.source_program_id] = (counts[workout.source_program_id] || 0) + 1;
  }
  return counts;
}

export function programNamesLabel(programs) {
  return (programs ?? []).map((program) => program.name).join(" · ");
}
