const workouts = [
  { id: 1, day: '\u05e8\u05d0\u05e9\u05d5\u05df', name: 'Upper Body Strength', status: '\u05d4\u05d5\u05e9\u05dc\u05dd', exercises: 4, isNext: false },
  { id: 2, day: '\u05e9\u05dc\u05d9\u05e9\u05d9', name: 'Lower Body Strength', status: '\u05d4\u05d1\u05d0 \u05d1\u05ea\u05d5\u05e8', exercises: 4, isNext: true },
  { id: 3, day: '\u05d7\u05de\u05d9\u05e9\u05d9', name: 'Core & Mobility', status: '\u05de\u05ea\u05d5\u05db\u05e0\u05df', exercises: 3, isNext: false },
  { id: 4, day: '\u05e9\u05d1\u05ea', name: 'Full Body', status: '\u05de\u05ea\u05d5\u05db\u05e0\u05df', exercises: 5, isNext: false },
];

export default function WeeklyPlanSimple({ onNav }) {
  return (
    <div className="workout-mobile">
      <div className="page-header">
        <div className="page-header-title">\u05d4\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d4\u05e9\u05d1\u05d5\u05e2\u05d9\u05ea \u05e9\u05dc\u05d9</div>
        <div className="page-header-sub">\u05d4\u05d0\u05d9\u05de\u05d5\u05e0\u05d9\u05dd \u05e9\u05ea\u05d5\u05db\u05e0\u05e0\u05d5 \u05dc\u05da \u05dc\u05e9\u05d1\u05d5\u05e2 \u05d4\u05e7\u05e8\u05d5\u05d1</div>
      </div>

      {workouts.map(workout => (
        <div className="ex-card-mobile" key={workout.id}>
          <div className="stepper-num">{workout.day}</div>
          <div className="ex-name-big">{workout.name}</div>
          <div className="muted text-sm mb-12">
            {workout.status} · {workout.exercises} \u05ea\u05e8\u05d2\u05d9\u05dc\u05d9\u05dd
          </div>

          {workout.isNext && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onNav('do-workout')}
            >
              \u05d4\u05ea\u05d7\u05dc\u05ea \u05d0\u05d9\u05de\u05d5\u05df
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
