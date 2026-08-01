import { useEffect, useMemo, useState } from "react";
import { fetchTrainees } from "../services/traineesService.js";
import {
  activateProgram,
  createProgram,
  createProgramDay,
  createProgramExercise,
  deleteProgram,
  deleteProgramDay,
  deleteProgramExercise,
  fetchProgramDetails,
  fetchPrograms,
  updateProgram,
  updateProgramDay,
  updateProgramExercise,
} from "../services/programsService.js";

const EMPTY_PROGRAM = {
  traineeId: "",
  name: "",
  goal: "",
  startDate: "",
  endDate: "",
  durationWeeks: "8",
  sessionsPerWeek: "3",
  isTemplate: false,
  notes: "",
};

const EMPTY_DAY = { name: "", dayOrder: "", notes: "" };

const EMPTY_EXERCISE = {
  name: "",
  exerciseOrder: "",
  sets: "3",
  reps: "",
  targetRir: "",
  restSeconds: "",
  notes: "",
};

const STATUS_LABELS = {
  draft: "טיוטה",
  active: "פעילה",
  archived: "בארכיון",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "0.5px solid #EDEBE6",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#FAF8F5",
};

const primaryButton = (disabled) => ({
  fontSize: 13,
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: disabled ? "#9E9A90" : "#7C2D3E",
  color: "#fff",
  cursor: disabled ? "not-allowed" : "pointer",
});

const secondaryButton = (disabled, danger = false) => ({
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 7,
  border: "0.5px solid #EDEBE6",
  background: "#fff",
  color: danger ? "#C0392B" : "#615E57",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
});

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

export default function Programs({ initialTraineeId = "" }) {
  const [trainees, setTrainees] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedTraineeId, setSelectedTraineeId] = useState(initialTraineeId);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionKey, setActionKey] = useState("");
  const [listFilter, setListFilter] = useState("all");

  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState("");
  const [programForm, setProgramForm] = useState(EMPTY_PROGRAM);

  const [showDayForm, setShowDayForm] = useState(false);
  const [editingDayId, setEditingDayId] = useState("");
  const [dayForm, setDayForm] = useState(EMPTY_DAY);

  const [exerciseDayId, setExerciseDayId] = useState("");
  const [editingExerciseId, setEditingExerciseId] = useState("");
  const [exerciseForm, setExerciseForm] = useState(EMPTY_EXERCISE);

  const selectedProgram = programs.find((program) => program.id === selectedProgramId);
  const visiblePrograms = useMemo(
    () =>
      selectedTraineeId
        ? programs.filter((program) => program.trainee_id === selectedTraineeId)
        : programs,
    [programs, selectedTraineeId]
  );
  const busy = Boolean(actionKey);

  async function loadAll() {
    setLoading(true);
    setLoadError("");

    try {
      const [traineeRows, programRows] = await Promise.all([
        fetchTrainees(),
        fetchPrograms(),
      ]);
      setTrainees(traineeRows);
      setPrograms(programRows);

      const requestedTraineeId = initialTraineeId || selectedTraineeId;
      const firstProgram = requestedTraineeId
        ? programRows.find((program) => program.trainee_id === requestedTraineeId)
        : null;

      setSelectedTraineeId(requestedTraineeId);
      setSelectedProgramId((currentId) =>
        programRows.some((program) => program.id === currentId)
          ? currentId
          : firstProgram?.id || ""
      );
    } catch (error) {
      console.error("Programs load error:", error);
      setLoadError("לא ניתן לטעון את תוכניות האימון כרגע.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // The component is remounted when navigating back from another view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDetails() {
      if (!selectedProgramId) {
        setDays([]);
        setDetailsError("");
        return;
      }

      setDetailsLoading(true);
      setDetailsError("");
      try {
        const rows = await fetchProgramDetails(selectedProgramId);
        if (active) setDays(rows);
      } catch (error) {
        console.error("Program details load error:", error);
        if (active) setDetailsError("לא ניתן לטעון את ימי האימון והתרגילים.");
      } finally {
        if (active) setDetailsLoading(false);
      }
    }

    loadDetails();
    return () => {
      active = false;
    };
  }, [selectedProgramId]);

  function beginCreateProgram() {
    setEditingProgramId("");
    setProgramForm({
      ...EMPTY_PROGRAM,
      traineeId: selectedTraineeId || trainees[0]?.id || "",
    });
    setShowProgramForm(true);
    setActionError("");
  }

  function beginEditProgram(program) {
    setEditingProgramId(program.id);
    setProgramForm({
      traineeId: program.trainee_id,
      name: program.name,
      goal: program.goal || "",
      startDate: program.start_date || "",
      endDate: program.end_date || "",
      notes: program.notes || "",
      durationWeeks: program.duration_weeks == null ? "" : String(program.duration_weeks),
      sessionsPerWeek:
        program.sessions_per_week == null ? "" : String(program.sessions_per_week),
      isTemplate: Boolean(program.is_template),
    });
    setShowProgramForm(true);
    setActionError("");
  }

  function beginDuplicateProgram(program) {
    setSelectedProgramId("");
    setEditingProgramId("");
    setProgramForm({
      traineeId: program.trainee_id,
      name: `${program.name} — עותק`,
      goal: program.goal || "",
      startDate: "",
      endDate: "",
      durationWeeks: program.duration_weeks == null ? "" : String(program.duration_weeks),
      sessionsPerWeek:
        program.sessions_per_week == null ? "" : String(program.sessions_per_week),
      isTemplate: Boolean(program.is_template),
      notes: program.notes || "",
    });
    setShowProgramForm(true);
    setActionError("");
  }

  async function handleSaveProgram() {
    const name = programForm.name.trim();
    if (!programForm.traineeId || !name) {
      setActionError("יש לבחור מתאמן ולהזין שם לתוכנית.");
      return;
    }
    if (
      programForm.startDate &&
      programForm.endDate &&
      programForm.endDate < programForm.startDate
    ) {
      setActionError("תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.");
      return;
    }

    const durationWeeks =
      programForm.durationWeeks === "" ? null : Number(programForm.durationWeeks);
    const sessionsPerWeek =
      programForm.sessionsPerWeek === "" ? null : Number(programForm.sessionsPerWeek);
    if (
      (durationWeeks !== null &&
        (!Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > 52)) ||
      (sessionsPerWeek !== null &&
        (!Number.isInteger(sessionsPerWeek) ||
          sessionsPerWeek < 1 ||
          sessionsPerWeek > 14))
    ) {
      setActionError("יש להזין מספר שבועות בין 1 ל־52 ואימונים בשבוע בין 1 ל־14.");
      return;
    }

    setActionKey("program-save");
    setActionError("");
    const payload = {
      trainee_id: programForm.traineeId,
      name,
      goal: programForm.goal.trim() || null,
      start_date: programForm.startDate || null,
      end_date: programForm.endDate || null,
      notes: programForm.notes.trim() || null,
      duration_weeks: durationWeeks,
      sessions_per_week: sessionsPerWeek,
      is_template: programForm.isTemplate,
    };

    try {
      if (editingProgramId) {
        const updated = await updateProgram(editingProgramId, payload);
        setPrograms((current) =>
          current.map((program) => (program.id === updated.id ? updated : program))
        );
        setSelectedTraineeId(updated.trainee_id);
      } else {
        const created = await createProgram(payload);
        setPrograms((current) => [created, ...current]);
        setSelectedTraineeId(created.trainee_id);
        setSelectedProgramId(created.id);
      }
      setShowProgramForm(false);
      setEditingProgramId("");
      setProgramForm(EMPTY_PROGRAM);
    } catch (error) {
      console.error("Program save error:", error);
      setActionError("לא ניתן לשמור את התוכנית. נסה שוב.");
    } finally {
      setActionKey("");
    }
  }

  async function handleActivate(program) {
    setActionKey(`activate-${program.id}`);
    setActionError("");
    try {
      const activated = await activateProgram(program.id);
      setPrograms((current) =>
        current.map((item) => {
          if (item.id === activated.id) return activated;
          if (item.trainee_id === activated.trainee_id && item.status === "active") {
            return { ...item, status: "archived" };
          }
          return item;
        })
      );
    } catch (error) {
      console.error("Program activation error:", error);
      setActionError("לא ניתן להפעיל את התוכנית. נסה שוב.");
    } finally {
      setActionKey("");
    }
  }

  async function handleDeleteProgram(program) {
    if (!window.confirm(`למחוק את התוכנית "${program.name}" ואת כל התוכן שלה?`)) {
      return;
    }

    setActionKey(`delete-${program.id}`);
    setActionError("");
    try {
      await deleteProgram(program.id);
      const remaining = programs.filter((item) => item.id !== program.id);
      setPrograms(remaining);
      setSelectedProgramId(
        remaining.find((item) => item.trainee_id === selectedTraineeId)?.id || ""
      );
    } catch (error) {
      console.error("Program delete error:", error);
      setActionError("לא ניתן למחוק את התוכנית.");
    } finally {
      setActionKey("");
    }
  }

  function beginCreateDay() {
    const nextOrder =
      days.reduce((max, day) => Math.max(max, day.day_order), 0) + 1;
    setEditingDayId("");
    setDayForm({ ...EMPTY_DAY, dayOrder: String(nextOrder) });
    setShowDayForm(true);
    setActionError("");
  }

  function beginEditDay(day) {
    setEditingDayId(day.id);
    setDayForm({
      name: day.name,
      dayOrder: String(day.day_order),
      notes: day.notes || "",
    });
    setShowDayForm(true);
    setActionError("");
  }

  async function handleSaveDay() {
    const name = dayForm.name.trim();
    const dayOrder = Number(dayForm.dayOrder);
    if (!name || !Number.isInteger(dayOrder) || dayOrder < 1) {
      setActionError("יש להזין שם יום וסדר חיובי.");
      return;
    }

    setActionKey("day-save");
    setActionError("");
    const payload = {
      program_id: selectedProgramId,
      name,
      day_order: dayOrder,
      notes: dayForm.notes.trim() || null,
    };

    try {
      if (editingDayId) {
        const updated = await updateProgramDay(editingDayId, payload);
        setDays((current) =>
          current
            .map((day) =>
              day.id === updated.id ? { ...updated, exercises: day.exercises } : day
            )
            .sort((a, b) => a.day_order - b.day_order)
        );
      } else {
        const created = await createProgramDay(payload);
        setDays((current) =>
          [...current, { ...created, exercises: [] }].sort(
            (a, b) => a.day_order - b.day_order
          )
        );
      }
      setShowDayForm(false);
      setEditingDayId("");
      setDayForm(EMPTY_DAY);
    } catch (error) {
      console.error("Program day save error:", error);
      setActionError("לא ניתן לשמור את יום האימון.");
    } finally {
      setActionKey("");
    }
  }

  async function handleDeleteDay(day) {
    if (!window.confirm(`למחוק את "${day.name}" ואת כל התרגילים שבו?`)) return;

    setActionKey(`day-delete-${day.id}`);
    setActionError("");
    try {
      await deleteProgramDay(day.id);
      setDays((current) => current.filter((item) => item.id !== day.id));
    } catch (error) {
      console.error("Program day delete error:", error);
      setActionError("לא ניתן למחוק את יום האימון.");
    } finally {
      setActionKey("");
    }
  }

  function beginCreateExercise(day) {
    const nextOrder =
      day.exercises.reduce(
        (max, exercise) => Math.max(max, exercise.exercise_order),
        0
      ) + 1;
    setExerciseDayId(day.id);
    setEditingExerciseId("");
    setExerciseForm({
      ...EMPTY_EXERCISE,
      exerciseOrder: String(nextOrder),
    });
    setActionError("");
  }

  function beginEditExercise(dayId, exercise) {
    setExerciseDayId(dayId);
    setEditingExerciseId(exercise.id);
    setExerciseForm({
      name: exercise.name,
      exerciseOrder: String(exercise.exercise_order),
      sets: String(exercise.sets),
      reps: exercise.reps,
      targetRir: exercise.target_rir == null ? "" : String(exercise.target_rir),
      restSeconds:
        exercise.rest_seconds == null ? "" : String(exercise.rest_seconds),
      notes: exercise.notes || "",
    });
    setActionError("");
  }

  async function handleSaveExercise() {
    const name = exerciseForm.name.trim();
    const order = Number(exerciseForm.exerciseOrder);
    const sets = Number(exerciseForm.sets);
    const targetRir =
      exerciseForm.targetRir === "" ? null : Number(exerciseForm.targetRir);
    const restSeconds =
      exerciseForm.restSeconds === "" ? null : Number(exerciseForm.restSeconds);

    if (
      !name ||
      !exerciseForm.reps.trim() ||
      !Number.isInteger(order) ||
      order < 1 ||
      !Number.isInteger(sets) ||
      sets < 1
    ) {
      setActionError("שם, סדר, מספר סטים וחזרות הם שדות חובה.");
      return;
    }
    if (targetRir != null && (Number.isNaN(targetRir) || targetRir < 0 || targetRir > 10)) {
      setActionError("RIR צריך להיות בין 0 ל־10.");
      return;
    }
    if (
      restSeconds != null &&
      (!Number.isInteger(restSeconds) || restSeconds < 0)
    ) {
      setActionError("זמן המנוחה צריך להיות מספר שניות חיובי.");
      return;
    }

    setActionKey("exercise-save");
    setActionError("");
    const payload = {
      program_day_id: exerciseDayId,
      name,
      exercise_order: order,
      sets,
      reps: exerciseForm.reps.trim(),
      target_rir: targetRir,
      rest_seconds: restSeconds,
      notes: exerciseForm.notes.trim() || null,
    };

    try {
      const saved = editingExerciseId
        ? await updateProgramExercise(editingExerciseId, payload)
        : await createProgramExercise(payload);

      setDays((current) =>
        current.map((day) => {
          if (day.id !== exerciseDayId) return day;
          const exercises = editingExerciseId
            ? day.exercises.map((exercise) =>
                exercise.id === saved.id ? saved : exercise
              )
            : [...day.exercises, saved];
          return {
            ...day,
            exercises: exercises.sort(
              (a, b) => a.exercise_order - b.exercise_order
            ),
          };
        })
      );
      setExerciseDayId("");
      setEditingExerciseId("");
      setExerciseForm(EMPTY_EXERCISE);
    } catch (error) {
      console.error("Program exercise save error:", error);
      setActionError("לא ניתן לשמור את התרגיל.");
    } finally {
      setActionKey("");
    }
  }

  async function handleDeleteExercise(dayId, exercise) {
    if (!window.confirm(`למחוק את התרגיל "${exercise.name}"?`)) return;

    setActionKey(`exercise-delete-${exercise.id}`);
    setActionError("");
    try {
      await deleteProgramExercise(exercise.id);
      setDays((current) =>
        current.map((day) =>
          day.id === dayId
            ? {
                ...day,
                exercises: day.exercises.filter(
                  (item) => item.id !== exercise.id
                ),
              }
            : day
        )
      );
    } catch (error) {
      console.error("Program exercise delete error:", error);
      setActionError("לא ניתן למחוק את התרגיל.");
    } finally {
      setActionKey("");
    }
  }

  function formatDate(value) {
    if (!value) return "ללא תאריך";
    return new Date(`${value}T12:00:00`).toLocaleDateString("he-IL");
  }

  function traineeName(program) {
    return trainees.find((trainee) => trainee.id === program.trainee_id)?.full_name ||
      "מתאמן לא זמין";
  }

  function daysUntil(value) {
    if (!value) return null;
    const start = new Date(`${value}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.ceil((start - today) / 86400000);
  }

  const activeProgramsCount = programs.filter(
    (program) => program.status === "active" && !program.is_template
  ).length;
  const templateProgramsCount = programs.filter((program) => program.is_template).length;
  const filteredPrograms = programs.filter((program) => {
    if (selectedTraineeId && program.trainee_id !== selectedTraineeId) return false;
    if (listFilter === "active") return program.status === "active" && !program.is_template;
    if (listFilter === "templates") return program.is_template;
    return true;
  });
  const upcomingProgram = programs
    .filter((program) => {
      const days = daysUntil(program.start_date);
      return days !== null && days >= 0 && program.status !== "archived";
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#9E9A90" }}>
        טוען תוכניות אימון...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ color: "#C0392B", marginBottom: 12 }}>{loadError}</div>
        <button onClick={loadAll} style={primaryButton(false)}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (!selectedProgram || showProgramForm) {
    return (
      <div className="programs-page slide-in">
        <div className="programs-page-header">
          <div>
            <h2>תוכניות אימון</h2>
            <p>
              {programs.length} תוכניות · {templateProgramsCount} {templateProgramsCount === 1 ? "תבנית" : "תבניות"}
            </p>
          </div>
          {!showProgramForm && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={beginCreateProgram}
              disabled={busy || trainees.length === 0}
            >
              + תוכנית חדשה
            </button>
          )}
        </div>

        {showProgramForm ? (
          <section className="card program-form-card">
            <div className="program-form-heading">
              <div>
                <span className="badge badge-inactive">
                  {editingProgramId ? "עריכה" : "טיוטה"}
                </span>
                <h3>{editingProgramId ? "עריכת תוכנית" : "תוכנית חדשה"}</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  setShowProgramForm(false);
                  setEditingProgramId("");
                  setProgramForm(EMPTY_PROGRAM);
                  setActionError("");
                }}
              >
                חזרה
              </button>
            </div>

            <div className="program-form-section">
              <div className="section-title">פרטי התוכנית</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">שם התוכנית *</label>
                  <input
                    className="form-input"
                    value={programForm.name}
                    onChange={(event) =>
                      setProgramForm((form) => ({ ...form, name: event.target.value }))
                    }
                    placeholder="לדוגמה: תוכנית כוח A/B"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">מתאמן *</label>
                  <select
                    className="form-select"
                    value={programForm.traineeId}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        traineeId: event.target.value,
                      }))
                    }
                  >
                    <option value="">בחר מתאמן</option>
                    {trainees.map((trainee) => (
                      <option key={trainee.id} value={trainee.id}>
                        {trainee.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">מטרת התוכנית</label>
                <input
                  className="form-input"
                  value={programForm.goal}
                  onChange={(event) =>
                    setProgramForm((form) => ({ ...form, goal: event.target.value }))
                  }
                  placeholder="מה התוכנית נועדה לקדם?"
                />
              </div>

              <div className="program-form-grid-3">
                <div className="form-group">
                  <label className="form-label">תאריך התחלה</label>
                  <input
                    className="form-input"
                    type="date"
                    value={programForm.startDate}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">תאריך סיום</label>
                  <input
                    className="form-input"
                    type="date"
                    value={programForm.endDate}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">מספר שבועות</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="52"
                    value={programForm.durationWeeks}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        durationWeeks: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="program-plan-row">
                <div className="form-group">
                  <label className="form-label">אימונים בשבוע</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="14"
                    value={programForm.sessionsPerWeek}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        sessionsPerWeek: event.target.value,
                      }))
                    }
                  />
                </div>
                <label className="program-template-check">
                  <input
                    type="checkbox"
                    checked={programForm.isTemplate}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        isTemplate: event.target.checked,
                      }))
                    }
                  />
                  שמור כתבנית לשימוש חוזר
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">הערות</label>
                <textarea
                  className="form-textarea"
                  value={programForm.notes}
                  onChange={(event) =>
                    setProgramForm((form) => ({ ...form, notes: event.target.value }))
                  }
                />
              </div>
            </div>

            {actionError && <div className="alert-strip danger">{actionError}</div>}

            <div className="program-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveProgram}
                disabled={busy}
              >
                {actionKey === "program-save" ? "שומר..." : "שמור תוכנית ✓"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => {
                  setShowProgramForm(false);
                  setEditingProgramId("");
                  setProgramForm(EMPTY_PROGRAM);
                  setActionError("");
                }}
              >
                ביטול
              </button>
            </div>
          </section>
        ) : trainees.length === 0 ? (
          <section className="card programs-empty-state">
            יש להוסיף מתאמן לפני יצירת תוכנית אימון.
          </section>
        ) : (
          <>
            <section className="card programs-upcoming">
              <div className="section-title">📌 תוכנית קרובה</div>
              {upcomingProgram ? (
                <button
                  type="button"
                  className="program-upcoming-link"
                  onClick={() => setSelectedProgramId(upcomingProgram.id)}
                >
                  {daysUntil(upcomingProgram.start_date) === 0
                    ? "התוכנית מתחילה היום"
                    : `התוכנית מתחילה בעוד ${daysUntil(upcomingProgram.start_date)} ימים`} · פתח
                </button>
              ) : (
                <span className="programs-muted">אין תוכנית מתוכננת להתחיל בקרוב.</span>
              )}
            </section>

            <div className="programs-list-toolbar">
              <div className="filters programs-filters">
                {[
                  ["all", `הכל (${programs.length})`],
                  ["active", `פעיל (${activeProgramsCount})`],
                  ["templates", `תבניות (${templateProgramsCount})`],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={`filter-chip ${listFilter === value ? "active" : ""}`}
                    onClick={() => setListFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="form-select programs-trainee-filter"
                value={selectedTraineeId}
                onChange={(event) => setSelectedTraineeId(event.target.value)}
                aria-label="סינון לפי מתאמן"
              >
                <option value="">כל המתאמנים</option>
                {trainees.map((trainee) => (
                  <option key={trainee.id} value={trainee.id}>
                    {trainee.full_name}
                  </option>
                ))}
              </select>
            </div>

            {actionError && <div className="alert-strip danger">{actionError}</div>}

            <div className="programs-list">
              {filteredPrograms.length === 0 ? (
                <section className="card programs-empty-state">
                  אין תוכניות שמתאימות לסינון שבחרת.
                </section>
              ) : (
                filteredPrograms.map((program) => (
                  <article
                    className="program-list-card"
                    key={program.id}
                    role="button"
                    tabIndex="0"
                    onClick={() => setSelectedProgramId(program.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedProgramId(program.id);
                      }
                    }}
                  >
                    <div className="program-list-main">
                      <div className="program-list-title-row">
                        <h3>{program.name}</h3>
                        <span className={`badge ${program.status === "active" ? "badge-active" : "badge-new"}`}>
                          {program.is_template ? "תבנית" : STATUS_LABELS[program.status]}
                        </span>
                      </div>
                      <p>
                        {traineeName(program)} · {program.days_count || 0} ימי אימון
                        {program.sessions_per_week
                          ? ` · ${program.sessions_per_week}× בשבוע`
                          : ""}
                        {program.duration_weeks ? ` · ${program.duration_weeks} שבועות` : ""}
                        {(program.start_date || program.end_date) &&
                          ` · ${formatDate(program.start_date)} – ${formatDate(program.end_date)}`}
                      </p>
                    </div>
                    <div className="program-list-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          beginEditProgram(program);
                        }}
                      >
                        ערוך
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          beginDuplicateProgram(program);
                        }}
                      >
                        שכפל
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteProgram(program);
                        }}
                      >
                        {actionKey === `delete-${program.id}` ? "מוחק..." : "מחק"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="program-editor-page slide-in">
      <button
        type="button"
        className="btn btn-ghost btn-sm program-editor-back"
        onClick={() => {
          setSelectedProgramId("");
          setSelectedTraineeId("");
        }}
      >
        → חזרה לתוכניות
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>
            תוכניות אימון
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>
            בניית תוכניות, ימי אימון ותרגילים לפי מתאמן
          </p>
        </div>
        <button
          onClick={beginCreateProgram}
          disabled={busy || trainees.length === 0}
          style={primaryButton(busy || trainees.length === 0)}
        >
          + תוכנית חדשה
        </button>
      </div>

      {trainees.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "0.5px solid #EDEBE6",
            padding: 24,
            textAlign: "center",
            color: "#9E9A90",
          }}
        >
          יש להוסיף מתאמן לפני יצירת תוכנית אימון.
        </div>
      ) : (
        <>
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "0.5px solid #EDEBE6",
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Field label="סינון לפי מתאמן">
              <select
                value={selectedTraineeId}
                onChange={(event) => {
                  const traineeId = event.target.value;
                  setSelectedTraineeId(traineeId);
                  setSelectedProgramId(
                    programs.find(
                      (program) =>
                        !traineeId || program.trainee_id === traineeId
                    )?.id || ""
                  );
                }}
                style={inputStyle}
              >
                <option value="">כל המתאמנים</option>
                {trainees.map((trainee) => (
                  <option key={trainee.id} value={trainee.id}>
                    {trainee.full_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {showProgramForm && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "0.5px solid #EDEBE6",
                padding: 20,
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
                {editingProgramId ? "עריכת תוכנית" : "תוכנית חדשה"}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <Field label="מתאמן *">
                  <select
                    value={programForm.traineeId}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        traineeId: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">בחר מתאמן</option>
                    {trainees.map((trainee) => (
                      <option key={trainee.id} value={trainee.id}>
                        {trainee.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="שם התוכנית *">
                  <input
                    value={programForm.name}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        name: event.target.value,
                      }))
                    }
                    style={inputStyle}
                    placeholder="לדוגמה: תוכנית כוח A/B"
                  />
                </Field>
                <Field label="תאריך התחלה">
                  <input
                    type="date"
                    value={programForm.startDate}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        startDate: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="תאריך סיום">
                  <input
                    type="date"
                    value={programForm.endDate}
                    onChange={(event) =>
                      setProgramForm((form) => ({
                        ...form,
                        endDate: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label="מטרת התוכנית">
                <input
                  value={programForm.goal}
                  onChange={(event) =>
                    setProgramForm((form) => ({
                      ...form,
                      goal: event.target.value,
                    }))
                  }
                  style={{ ...inputStyle, marginBottom: 12 }}
                />
              </Field>
              <Field label="הערות">
                <textarea
                  value={programForm.notes}
                  onChange={(event) =>
                    setProgramForm((form) => ({
                      ...form,
                      notes: event.target.value,
                    }))
                  }
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                />
              </Field>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={handleSaveProgram}
                  disabled={busy}
                  style={primaryButton(busy)}
                >
                  {actionKey === "program-save" ? "שומר..." : "שמור תוכנית"}
                </button>
                <button
                  onClick={() => {
                    setShowProgramForm(false);
                    setEditingProgramId("");
                    setProgramForm(EMPTY_PROGRAM);
                    setActionError("");
                  }}
                  disabled={busy}
                  style={secondaryButton(busy)}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <div style={{ color: "#C0392B", fontSize: 13, marginBottom: 12 }}>
              {actionError}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "0.5px solid #EDEBE6",
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                תוכניות
              </div>
              {visiblePrograms.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "#9E9A90",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  אין תוכניות להצגה.
                </div>
              ) : (
                visiblePrograms.map((program) => {
                  const trainee = trainees.find(
                    (item) => item.id === program.trainee_id
                  );
                  const selected = program.id === selectedProgramId;
                  return (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => setSelectedProgramId(program.id)}
                      style={{
                        width: "100%",
                        textAlign: "right",
                        padding: 12,
                        marginBottom: 8,
                        borderRadius: 9,
                        border: selected
                          ? "1px solid #7C2D3E"
                          : "0.5px solid #EDEBE6",
                        background: selected ? "#F9F0F2" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {program.name}
                      </div>
                      <div style={{ color: "#9E9A90", fontSize: 11 }}>
                        {trainee?.full_name || "מתאמן"} ·{" "}
                        {STATUS_LABELS[program.status]}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div>
              {!selectedProgram ? (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "0.5px solid #EDEBE6",
                    padding: 32,
                    textAlign: "center",
                    color: "#9E9A90",
                  }}
                >
                  בחר תוכנית או צור תוכנית חדשה.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      border: "0.5px solid #EDEBE6",
                      padding: 20,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                          {selectedProgram.name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#7C2D3E",
                            marginTop: 3,
                          }}
                        >
                          {STATUS_LABELS[selectedProgram.status]}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        {selectedProgram.status !== "active" && (
                          <button
                            onClick={() => handleActivate(selectedProgram)}
                            disabled={busy}
                            style={primaryButton(busy)}
                          >
                            {actionKey === `activate-${selectedProgram.id}`
                              ? "מפעיל..."
                              : "הפעל תוכנית"}
                          </button>
                        )}
                        <button
                          onClick={() => beginEditProgram(selectedProgram)}
                          disabled={busy}
                          style={secondaryButton(busy)}
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDeleteProgram(selectedProgram)}
                          disabled={busy}
                          style={secondaryButton(busy, true)}
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                    {selectedProgram.goal && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#615E57",
                          marginTop: 10,
                        }}
                      >
                        מטרה: {selectedProgram.goal}
                      </div>
                    )}
                    {(selectedProgram.start_date || selectedProgram.end_date) && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#9E9A90",
                          marginTop: 4,
                        }}
                      >
                        {selectedProgram.start_date || "ללא תאריך"} –{" "}
                        {selectedProgram.end_date || "ללא תאריך סיום"}
                      </div>
                    )}
                    {selectedProgram.notes && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#9E9A90",
                          marginTop: 4,
                        }}
                      >
                        {selectedProgram.notes}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      ימי אימון
                    </div>
                    <button
                      onClick={beginCreateDay}
                      disabled={busy}
                      style={primaryButton(busy)}
                    >
                      + יום אימון
                    </button>
                  </div>

                  {showDayForm && (
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: 12,
                        border: "0.5px solid #EDEBE6",
                        padding: 16,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(180px, 2fr) minmax(90px, 0.6fr)",
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <Field label="שם היום *">
                          <input
                            value={dayForm.name}
                            onChange={(event) =>
                              setDayForm((form) => ({
                                ...form,
                                name: event.target.value,
                              }))
                            }
                            style={inputStyle}
                            placeholder="לדוגמה: אימון A"
                          />
                        </Field>
                        <Field label="סדר *">
                          <input
                            type="number"
                            min="1"
                            value={dayForm.dayOrder}
                            onChange={(event) =>
                              setDayForm((form) => ({
                                ...form,
                                dayOrder: event.target.value,
                              }))
                            }
                            style={inputStyle}
                          />
                        </Field>
                      </div>
                      <Field label="הערות">
                        <input
                          value={dayForm.notes}
                          onChange={(event) =>
                            setDayForm((form) => ({
                              ...form,
                              notes: event.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </Field>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={handleSaveDay}
                          disabled={busy}
                          style={primaryButton(busy)}
                        >
                          {actionKey === "day-save" ? "שומר..." : "שמור יום"}
                        </button>
                        <button
                          onClick={() => {
                            setShowDayForm(false);
                            setEditingDayId("");
                            setDayForm(EMPTY_DAY);
                          }}
                          disabled={busy}
                          style={secondaryButton(busy)}
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}

                  {detailsLoading ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#9E9A90",
                        padding: 24,
                      }}
                    >
                      טוען את פרטי התוכנית...
                    </div>
                  ) : detailsError ? (
                    <div style={{ color: "#C0392B", fontSize: 13 }}>
                      {detailsError}
                    </div>
                  ) : days.length === 0 ? (
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: 12,
                        border: "0.5px solid #EDEBE6",
                        padding: 24,
                        textAlign: "center",
                        color: "#9E9A90",
                      }}
                    >
                      אין ימי אימון בתוכנית. הוסף את היום הראשון.
                    </div>
                  ) : (
                    days.map((day) => (
                      <div
                        key={day.id}
                        style={{
                          background: "#fff",
                          borderRadius: 12,
                          border: "0.5px solid #EDEBE6",
                          padding: 16,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            marginBottom: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {day.day_order}. {day.name}
                            </div>
                            {day.notes && (
                              <div
                                style={{
                                  color: "#9E9A90",
                                  fontSize: 12,
                                  marginTop: 2,
                                }}
                              >
                                {day.notes}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => beginCreateExercise(day)}
                              disabled={busy}
                              style={secondaryButton(busy)}
                            >
                              + תרגיל
                            </button>
                            <button
                              onClick={() => beginEditDay(day)}
                              disabled={busy}
                              style={secondaryButton(busy)}
                            >
                              ערוך יום
                            </button>
                            <button
                              onClick={() => handleDeleteDay(day)}
                              disabled={busy}
                              style={secondaryButton(busy, true)}
                            >
                              מחק יום
                            </button>
                          </div>
                        </div>

                        {exerciseDayId === day.id && (
                          <div
                            style={{
                              background: "#FAF8F5",
                              borderRadius: 9,
                              padding: 12,
                              marginBottom: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(110px, 1fr))",
                                gap: 10,
                              }}
                            >
                              <Field label="שם התרגיל *">
                                <input
                                  value={exerciseForm.name}
                                  onChange={(event) =>
                                    setExerciseForm((form) => ({
                                      ...form,
                                      name: event.target.value,
                                    }))
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                              <Field label="סדר *">
                                <input
                                  type="number"
                                  min="1"
                                  value={exerciseForm.exerciseOrder}
                                  onChange={(event) =>
                                    setExerciseForm((form) => ({
                                      ...form,
                                      exerciseOrder: event.target.value,
                                    }))
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                              <Field label="סטים *">
                                <input
                                  type="number"
                                  min="1"
                                  value={exerciseForm.sets}
                                  onChange={(event) =>
                                    setExerciseForm((form) => ({
                                      ...form,
                                      sets: event.target.value,
                                    }))
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                              <Field label="חזרות *">
                                <input
                                  value={exerciseForm.reps}
                                  onChange={(event) =>
                                    setExerciseForm((form) => ({
                                      ...form,
                                      reps: event.target.value,
                                    }))
                                  }
                                  style={inputStyle}
                                  placeholder="8-12"
                                />
                              </Field>
                              <Field label="RIR יעד">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.5"
                                  value={exerciseForm.targetRir}
                                  onChange={(event) =>
                                    setExerciseForm((form) => ({
                                      ...form,
                                      targetRir: event.target.value,
                                    }))
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                              <Field label="מנוחה בשניות">
                                <input
                                  type="number"
                                  min="0"
                                  value={exerciseForm.restSeconds}
                                  onChange={(event) =>
                                    setExerciseForm((form) => ({
                                      ...form,
                                      restSeconds: event.target.value,
                                    }))
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                            </div>
                            <Field label="הערות">
                              <input
                                value={exerciseForm.notes}
                                onChange={(event) =>
                                  setExerciseForm((form) => ({
                                    ...form,
                                    notes: event.target.value,
                                  }))
                                }
                                style={{ ...inputStyle, marginTop: 8 }}
                              />
                            </Field>
                            <div
                              style={{ display: "flex", gap: 8, marginTop: 10 }}
                            >
                              <button
                                onClick={handleSaveExercise}
                                disabled={busy}
                                style={primaryButton(busy)}
                              >
                                {actionKey === "exercise-save"
                                  ? "שומר..."
                                  : "שמור תרגיל"}
                              </button>
                              <button
                                onClick={() => {
                                  setExerciseDayId("");
                                  setEditingExerciseId("");
                                  setExerciseForm(EMPTY_EXERCISE);
                                }}
                                disabled={busy}
                                style={secondaryButton(busy)}
                              >
                                ביטול
                              </button>
                            </div>
                          </div>
                        )}

                        {day.exercises.length === 0 ? (
                          <div
                            style={{
                              color: "#9E9A90",
                              fontSize: 12,
                              padding: "8px 0",
                            }}
                          >
                            אין תרגילים ביום זה.
                          </div>
                        ) : (
                          day.exercises.map((exercise) => (
                            <div
                              key={exercise.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 0",
                                borderTop: "0.5px solid #EDEBE6",
                                flexWrap: "wrap",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                  {exercise.exercise_order}. {exercise.name}
                                </div>
                                <div
                                  style={{ fontSize: 12, color: "#9E9A90" }}
                                >
                                  {exercise.sets} סטים · {exercise.reps} חזרות
                                  {exercise.target_rir != null
                                    ? ` · RIR ${exercise.target_rir}`
                                    : ""}
                                  {exercise.rest_seconds != null
                                    ? ` · מנוחה ${exercise.rest_seconds} שנ׳`
                                    : ""}
                                </div>
                                {exercise.notes && (
                                  <div
                                    style={{ fontSize: 11, color: "#9E9A90" }}
                                  >
                                    {exercise.notes}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={() =>
                                    beginEditExercise(day.id, exercise)
                                  }
                                  disabled={busy}
                                  style={secondaryButton(busy)}
                                >
                                  ערוך
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteExercise(day.id, exercise)
                                  }
                                  disabled={busy}
                                  style={secondaryButton(busy, true)}
                                >
                                  מחק
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
