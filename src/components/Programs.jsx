import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTrainees } from "../services/traineesService.js";
import { useRememberedState } from "../lib/navigationMemory.js";
import {
  activateProgram,
  createProgram,
  createProgramDay,
  createProgramExercise,
  deleteProgram,
  duplicateProgram,
  deleteProgramDay,
  deleteProgramExercise,
  fetchProgramDetails,
  fetchPrograms,
  reorderProgramExercises,
  updateProgram,
  updateProgramDay,
  updateProgramExercise,
  DEMO_VIDEO_ACCEPT,
  uploadExerciseDemoVideo,
  validateExerciseDemoVideo,
} from "../services/programsService.js";
import { normalizeVideoLink } from "../lib/videoLink.js";
import ExerciseDemoVideo from "./ExerciseDemoVideo.jsx";

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
  targetWeightKg: "",
  targetRir: "",
  restSeconds: "",
  notes: "",
  demoMode: "none",
  demoVideoUrl: "",
  demoFile: null,
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

function demoVideoErrorMessage(error) {
  if (error?.message === "unsupported-video") {
    return "סוג הקובץ לא נתמך. אפשר להעלות MP4, MOV, WEBM או M4V.";
  }
  if (error?.message === "video-too-large") {
    return "הסרטון גדול מדי. הגודל המרבי הוא 50MB.";
  }
  return "לא ניתן להעלות את הסרטון. נסו שוב.";
}

const INVALID_LINK_MESSAGE =
  "הקישור לסרטון לא תקין. יש להדביק את הקישור המלא, שמתחיל ב-https:// (אפשר להעתיק אותו מכפתור \"שיתוף\" באפליקציה).";

// The demo an exercise has now: an external link or an uploaded file, never
// both (every save and upload clears the other one).
function demoSource(exercise) {
  if (exercise?.demo_video_url) return "link";
  if (exercise?.demo_video_path) return "file";
  return "none";
}

const DEMO_SOURCE_LABELS = {
  link: "קישור לסרטון",
  file: "סרטון שהועלה",
};

const DEMO_MODES = [
  { id: "none", label: "ללא סרטון" },
  { id: "file", label: "העלאת סרטון" },
  { id: "link", label: "קישור לסרטון הדגמה" },
];

// What saving the form will do to the current demo, said before it happens.
function demoChangeNotice(current, form) {
  if (current === "none") return "";
  if (form.demoMode === "none") return "סרטון ההדגמה הנוכחי יוסר בשמירה.";
  if (form.demoMode === "file" && current === "link") {
    return form.demoFile ? "בשמירה, הקישור הנוכחי יוחלף בסרטון שנבחר." : "";
  }
  if (form.demoMode === "file" && form.demoFile) return "בשמירה, הסרטון הנוכחי יוחלף בקובץ החדש.";
  if (form.demoMode === "link" && current === "file") {
    return "בשמירה, הסרטון שהועלה יוסר ויוחלף בקישור.";
  }
  return "";
}

// The demo-video part of the exercise create/edit form: no video, an
// uploaded file (023 storage flow) or an external video link (026/028).
function DemoVideoFormSection({ exercise, form, setForm, busy }) {
  const current = demoSource(exercise);
  const notice = demoChangeNotice(current, form);
  const [fileError, setFileError] = useState("");

  function setMode(demoMode) {
    setFileError("");
    setForm((value) => ({ ...value, demoMode }));
  }

  function pickFile(file) {
    if (!file) return;
    try {
      validateExerciseDemoVideo(file);
      setFileError("");
      setForm((value) => ({ ...value, demoFile: file }));
    } catch (error) {
      setFileError(demoVideoErrorMessage(error));
    }
  }

  return (
    <div className="program-demo-form">
      <div className="program-demo-form-title">🎬 סרטון הדגמה</div>
      {current !== "none" && (
        <div className="program-demo-form-current">
          <span>נוכחי: {DEMO_SOURCE_LABELS[current]}</span>
          <ExerciseDemoVideo
            url={exercise.demo_video_url}
            path={exercise.demo_video_path}
            exerciseName={exercise.name}
            label="▶ צפייה"
            className=""
            style={secondaryButton(false)}
          />
        </div>
      )}
      <div className="program-demo-form-options" role="radiogroup" aria-label="מקור סרטון ההדגמה">
        {DEMO_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={form.demoMode === mode.id}
            className={form.demoMode === mode.id ? "active" : ""}
            onClick={() => setMode(mode.id)}
            disabled={busy}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {form.demoMode === "file" && (
        <div className="program-demo-form-body">
          {form.demoFile ? (
            <div className="program-demo-form-file">
              <span>{form.demoFile.name}</span>
              <button
                type="button"
                onClick={() => setForm((value) => ({ ...value, demoFile: null }))}
                disabled={busy}
                style={secondaryButton(busy)}
              >
                ביטול בחירה
              </button>
            </div>
          ) : (
            <label className="program-demo-form-picker" style={secondaryButton(busy)}>
              {current === "file" ? "החלפת סרטון" : "בחירת קובץ וידאו"}
              <input
                type="file"
                accept={DEMO_VIDEO_ACCEPT}
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  pickFile(file);
                }}
              />
            </label>
          )}
          <small>MP4, MOV, WEBM או M4V, עד 50MB. הסרטון יעלה בשמירת התרגיל.</small>
          {fileError && <div className="program-demo-video-error" role="alert">{fileError}</div>}
        </div>
      )}

      {form.demoMode === "link" && (
        <div className="program-demo-form-body program-demo-video-link">
          <input
            type="url"
            inputMode="url"
            dir="ltr"
            placeholder="הדביקי קישור לסרטון"
            aria-label="קישור לסרטון הדגמה"
            value={form.demoVideoUrl}
            onChange={(event) =>
              setForm((value) => ({ ...value, demoVideoUrl: event.target.value }))
            }
            disabled={busy}
            style={inputStyle}
          />
          {normalizeVideoLink(form.demoVideoUrl) && (
            <ExerciseDemoVideo
              url={form.demoVideoUrl}
              exerciseName={form.name || "תרגיל"}
              label="▶ בדיקת הקישור ↗"
              className=""
              style={secondaryButton(false)}
            />
          )}
        </div>
      )}

      {notice && <div className="program-demo-form-notice">{notice}</div>}
    </div>
  );
}

// The demo-video cell of a saved exercise row. Changing or removing the
// video happens in the exercise edit form, so the row only offers viewing.
function DemoVideoSection({ exercise, busy, onManage }) {
  const source = demoSource(exercise);
  return (
    <div className="program-exercise-video">
      {source !== "none" ? (
        <span title={DEMO_SOURCE_LABELS[source]}>
          <ExerciseDemoVideo
            url={exercise.demo_video_url}
            path={exercise.demo_video_path}
            exerciseName={exercise.name}
            label="▶ צפייה בסרטון"
            className="program-video-btn"
          />
        </span>
      ) : (
        <button type="button" className="program-video-add" onClick={onManage} disabled={busy}>
          + סרטון הדגמה
        </button>
      )}
    </div>
  );
}

// One labelled value (sets, reps, ...) in an exercise row.
function ExerciseSpec({ label, value }) {
  const empty = value == null || value === "";
  return (
    <div className={`program-exercise-spec${empty ? " empty" : ""}`}>
      <span>{label}</span>
      <strong>{empty ? "—" : value}</strong>
    </div>
  );
}

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
  const [selectedTraineeId, setSelectedTraineeId] = useRememberedState(
    "programs:trainee",
    initialTraineeId,
    (value) => typeof value === "string" && value.length <= 64
  );
  const [selectedProgramId, setSelectedProgramId] = useRememberedState(
    "programs:program",
    "",
    (value) => typeof value === "string" && value.length <= 64
  );
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
  const [duplicateSourceId, setDuplicateSourceId] = useState("");
  const [programForm, setProgramForm] = useState(EMPTY_PROGRAM);

  const [showDayForm, setShowDayForm] = useState(false);
  const [editingDayId, setEditingDayId] = useState("");
  const [dayForm, setDayForm] = useState(EMPTY_DAY);

  const [exerciseDayId, setExerciseDayId] = useState("");
  const [editingExerciseId, setEditingExerciseId] = useState("");
  const [exerciseForm, setExerciseForm] = useState(EMPTY_EXERCISE);
  const [demoErrors, setDemoErrors] = useState({});

  const selectedProgram = programs.find((program) => program.id === selectedProgramId);
  const visiblePrograms = useMemo(
    () =>
      selectedTraineeId
        ? programs.filter((program) => program.trainee_id === selectedTraineeId)
        : programs,
    [programs, selectedTraineeId]
  );
  const busy = Boolean(actionKey);
  // Blocks a second move that lands before the buttons re-render as disabled.
  const movingExercise = useRef(false);

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

      const requestedTraineeId = [initialTraineeId, selectedTraineeId].find(
        (id) => id && traineeRows.some((trainee) => trainee.id === id)
      ) || "";
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
    setDuplicateSourceId("");
    setProgramForm({
      ...EMPTY_PROGRAM,
      traineeId: selectedTraineeId || trainees[0]?.id || "",
    });
    setShowProgramForm(true);
    setActionError("");
  }

  function beginEditProgram(program) {
    setEditingProgramId(program.id);
    setDuplicateSourceId("");
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
    setDuplicateSourceId(program.id);
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
        const created = duplicateSourceId
          ? await duplicateProgram(duplicateSourceId, payload)
          : await createProgram(payload);
        setPrograms((current) => [created, ...current]);
        setSelectedTraineeId(created.trainee_id);
        setSelectedProgramId(created.id);
      }
      setShowProgramForm(false);
      setEditingProgramId("");
      setDuplicateSourceId("");
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
      setActionError("יש להזין שם אימון.");
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
    setDemoErrors({});
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
      targetWeightKg:
        exercise.target_weight_kg == null ? "" : String(exercise.target_weight_kg),
      targetRir: exercise.target_rir == null ? "" : String(exercise.target_rir),
      restSeconds:
        exercise.rest_seconds == null ? "" : String(exercise.rest_seconds),
      notes: exercise.notes || "",
      demoMode: demoSource(exercise),
      demoVideoUrl: exercise.demo_video_url || "",
      demoFile: null,
    });
    setDemoErrors({});
    setActionError("");
  }

  async function handleSaveExercise() {
    const name = exerciseForm.name.trim();
    const order = Number(exerciseForm.exerciseOrder);
    const sets = Number(exerciseForm.sets);
    const targetWeightKg =
      exerciseForm.targetWeightKg === ""
        ? null
        : Number(exerciseForm.targetWeightKg);
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
      setActionError("שם, מספר סטים וחזרות הם שדות חובה.");
      return;
    }
    if (targetRir != null && (Number.isNaN(targetRir) || targetRir < 0 || targetRir > 10)) {
      setActionError("RIR צריך להיות בין 0 ל־10.");
      return;
    }
    if (
      targetWeightKg != null &&
      (Number.isNaN(targetWeightKg) || targetWeightKg < 0 || targetWeightKg > 2000)
    ) {
      setActionError("משקל היעד צריך להיות בין 0 ל־2,000 ק״ג.");
      return;
    }
    if (
      restSeconds != null &&
      (!Number.isInteger(restSeconds) || restSeconds < 0)
    ) {
      setActionError("זמן המנוחה צריך להיות מספר שניות חיובי.");
      return;
    }
    const editingExercise = editingExerciseId
      ? days
          .find((day) => day.id === exerciseDayId)
          ?.exercises.find((exercise) => exercise.id === editingExerciseId)
      : null;
    const currentDemo = demoSource(editingExercise);
    const { demoMode, demoFile } = exerciseForm;
    const demoVideoUrl =
      demoMode === "link" ? normalizeVideoLink(exerciseForm.demoVideoUrl) : null;
    if (demoMode === "link" && !exerciseForm.demoVideoUrl.trim()) {
      setActionError("יש להדביק קישור לסרטון, או לבחור \"ללא סרטון\".");
      return;
    }
    if (demoMode === "link" && !demoVideoUrl) {
      setActionError(INVALID_LINK_MESSAGE);
      return;
    }
    if (demoMode === "file" && !demoFile && currentDemo !== "file") {
      setActionError("יש לבחור קובץ וידאו להעלאה, או לבחור \"ללא סרטון\".");
      return;
    }
    const replacing =
      currentDemo !== "none" && demoMode !== currentDemo && (demoMode !== "file" || demoFile);
    if (replacing) {
      const question =
        demoMode === "none"
          ? `להסיר את סרטון ההדגמה של "${name}"?`
          : demoMode === "link"
            ? "הסרטון שהועלה יוסר ויוחלף בקישור. להמשיך?"
            : "הקישור לסרטון יוחלף בסרטון שהועלה. להמשיך?";
      if (!window.confirm(question)) return;
    }

    setActionKey("exercise-save");
    setActionError("");
    const payload = {
      program_day_id: exerciseDayId,
      name,
      exercise_order: order,
      sets,
      reps: exerciseForm.reps.trim(),
      target_weight_kg: targetWeightKg,
      target_rir: targetRir,
      rest_seconds: restSeconds,
      notes: exerciseForm.notes.trim() || null,
    };
    // A new file replaces the current demo only once it has uploaded, so a
    // failed upload keeps whatever the exercise had before.
    if (demoMode !== "file") {
      payload.demo_video_url = demoVideoUrl;
      payload.clear_demo_file = currentDemo === "file";
      payload.previous_demo_video_path = editingExercise?.demo_video_path ?? null;
    }

    try {
      let saved = editingExerciseId
        ? await updateProgramExercise(editingExerciseId, payload)
        : await createProgramExercise(payload);

      if (demoMode === "file" && demoFile) {
        try {
          saved = await uploadExerciseDemoVideo(saved, demoFile);
        } catch (uploadError) {
          console.error("Demo video upload error:", uploadError);
          setDemoErrors({
            [saved.id]: `התרגיל נשמר, אבל הסרטון לא עלה. ${demoVideoErrorMessage(uploadError)}`,
          });
        }
      }

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

  // Moves an exercise one place up (-1) or down (+1). Normally the two
  // exercises just swap exercise_order values; if the day has equal or
  // unsorted orders, every exercise whose place changes is renumbered 1..n.
  async function handleMoveExercise(dayId, exercise, direction) {
    if (actionKey || movingExercise.current) return;
    const day = days.find((item) => item.id === dayId);
    const list = day ? day.exercises : [];
    const from = list.findIndex((item) => item.id === exercise.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;

    const reordered = [...list];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    const strictlyIncreasing = list.every(
      (item, index) => index === 0 || item.exercise_order > list[index - 1].exercise_order
    );
    const newOrders = strictlyIncreasing
      ? new Map([
          [list[from].id, list[to].exercise_order],
          [list[to].id, list[from].exercise_order],
        ])
      : new Map(reordered.map((item, index) => [item.id, index + 1]));
    const changes = list
      .filter((item) => newOrders.has(item.id) && newOrders.get(item.id) !== item.exercise_order)
      .map((item) => ({
        id: item.id,
        exercise_order: newOrders.get(item.id),
        previous_order: item.exercise_order,
      }));

    movingExercise.current = true;
    setActionKey(`exercise-move-${exercise.id}`);
    setActionError("");
    try {
      await reorderProgramExercises(changes);
      setDays((current) =>
        current.map((item) =>
          item.id === dayId
            ? {
                ...item,
                exercises: reordered.map((row) =>
                  newOrders.has(row.id)
                    ? { ...row, exercise_order: newOrders.get(row.id) }
                    : row
                ),
              }
            : item
        )
      );
    } catch (error) {
      console.error("Program exercise reorder error:", error);
      setActionError("לא ניתן לשנות את סדר התרגילים. נסה שוב.");
    } finally {
      movingExercise.current = false;
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
                <h3>{editingProgramId
                  ? "עריכת תוכנית"
                  : duplicateSourceId
                    ? "שכפול תוכנית"
                    : "תוכנית חדשה"}</h3>
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
                        {traineeName(program)} · {program.days_count || 0} סוגי אימון
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

  const formOpen = showDayForm || Boolean(exerciseDayId);
  const exerciseCountLabel = (count) => (count === 1 ? "תרגיל אחד" : `${count} תרגילים`);

  function renderDayForm() {
    return (
      <div className="program-inline-form program-day-form">
        <div className="program-inline-form-title">
          {editingDayId ? "עריכת סוג אימון" : "סוג אימון חדש"}
        </div>
        <div className="program-day-form-grid">
          <Field label="שם אימון *">
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
        </div>
        {actionError && <div className="alert-strip danger">{actionError}</div>}
        <div className="program-inline-form-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveDay}
            disabled={busy}
          >
            {actionKey === "day-save" ? "שומר..." : "שמור סוג אימון"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setShowDayForm(false);
              setEditingDayId("");
              setDayForm(EMPTY_DAY);
            }}
            disabled={busy}
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  function renderExerciseForm(day) {
    return (
      <div className="program-inline-form program-exercise-form">
        <div className="program-inline-form-title">
          {editingExerciseId ? "עריכת תרגיל" : "תרגיל חדש"}
        </div>
        <div className="program-exercise-form-grid">
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
          <Field label="משקל יעד (ק״ג)">
            <input
              type="number"
              min="0"
              max="2000"
              step="0.25"
              inputMode="decimal"
              value={exerciseForm.targetWeightKg}
              onChange={(event) =>
                setExerciseForm((form) => ({
                  ...form,
                  targetWeightKg: event.target.value,
                }))
              }
              style={inputStyle}
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
            style={inputStyle}
          />
        </Field>
        <DemoVideoFormSection
          key={editingExerciseId || "new"}
          exercise={
            editingExerciseId
              ? day.exercises.find((exercise) => exercise.id === editingExerciseId)
              : null
          }
          form={exerciseForm}
          setForm={setExerciseForm}
          busy={busy}
        />
        {actionError && <div className="alert-strip danger">{actionError}</div>}
        <div className="program-inline-form-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveExercise}
            disabled={busy}
          >
            {actionKey === "exercise-save" ? "שומר..." : "שמור תרגיל"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setExerciseDayId("");
              setEditingExerciseId("");
              setExerciseForm(EMPTY_EXERCISE);
            }}
            disabled={busy}
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  function renderExerciseRow(day, exercise, exerciseIndex) {
    const isFirst = exerciseIndex === 0;
    const isLast = exerciseIndex === day.exercises.length - 1;
    return (
      <div className="program-exercise-row" key={exercise.id}>
        <div className="program-exercise-move">
          <button
            type="button"
            className="program-move-btn"
            onClick={() => handleMoveExercise(day.id, exercise, -1)}
            disabled={busy || isFirst}
            aria-label={`העלה את ${exercise.name}`}
            title="העלה"
          >
            {actionKey === `exercise-move-${exercise.id}` ? "…" : "↑"}
          </button>
          <button
            type="button"
            className="program-move-btn"
            onClick={() => handleMoveExercise(day.id, exercise, 1)}
            disabled={busy || isLast}
            aria-label={`הורד את ${exercise.name}`}
            title="הורד"
          >
            ↓
          </button>
        </div>
        <div className="program-exercise-name">
          <span className="program-exercise-index">{exerciseIndex + 1}</span>
          <div>
            <strong>{exercise.name}</strong>
            {exercise.notes && <small>{exercise.notes}</small>}
          </div>
        </div>
        <div className="program-exercise-specs">
          <ExerciseSpec label="סטים" value={exercise.sets} />
          <ExerciseSpec label="חזרות" value={exercise.reps} />
          <ExerciseSpec
            label="משקל"
            value={exercise.target_weight_kg != null ? `${exercise.target_weight_kg} ק״ג` : null}
          />
          <ExerciseSpec label="RIR" value={exercise.target_rir} />
          <ExerciseSpec
            label="מנוחה"
            value={exercise.rest_seconds != null ? `${exercise.rest_seconds} שנ׳` : null}
          />
        </div>
        <DemoVideoSection
          exercise={exercise}
          busy={busy}
          onManage={() => beginEditExercise(day.id, exercise)}
        />
        <div className="program-exercise-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => beginEditExercise(day.id, exercise)}
            disabled={busy}
            aria-label={`ערוך את ${exercise.name}`}
          >
            ערוך
          </button>
          <button
            type="button"
            className="btn btn-sm program-action-danger"
            onClick={() => handleDeleteExercise(day.id, exercise)}
            disabled={busy}
            aria-label={`מחק את ${exercise.name}`}
          >
            מחק
          </button>
        </div>
        {demoErrors[exercise.id] && (
          <div className="program-demo-video-error" role="alert">
            {demoErrors[exercise.id]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="program-editor-page slide-in">
      <div className="program-editor-toolbar">
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
        <div className="program-editor-switch">
          <select
            className="form-select"
            aria-label="סינון לפי מתאמן"
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
          >
            <option value="">כל המתאמנים</option>
            {trainees.map((trainee) => (
              <option key={trainee.id} value={trainee.id}>
                {trainee.full_name}
              </option>
            ))}
          </select>
          <select
            className="form-select"
            aria-label="מעבר לתוכנית"
            value={selectedProgramId}
            onChange={(event) => setSelectedProgramId(event.target.value)}
          >
            {visiblePrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {selectedTraineeId
                  ? program.name
                  : `${program.name} · ${traineeName(program)}`}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={beginCreateProgram}
          disabled={busy || trainees.length === 0}
        >
          + תוכנית חדשה
        </button>
      </div>

      <section className="card program-summary">
        <div className="program-summary-main">
          <div className="program-summary-title">
            <h2>{selectedProgram.name}</h2>
            <span
              className={`badge ${
                selectedProgram.status === "active" ? "badge-active" : "badge-inactive"
              }`}
            >
              {STATUS_LABELS[selectedProgram.status]}
            </span>
            {selectedProgram.is_template && <span className="badge badge-burg">תבנית</span>}
          </div>
          <p className="program-summary-meta">
            {traineeName(selectedProgram)}
            {selectedProgram.goal ? ` · מטרה: ${selectedProgram.goal}` : ""}
            {(selectedProgram.start_date || selectedProgram.end_date) &&
              ` · ${formatDate(selectedProgram.start_date)} – ${formatDate(selectedProgram.end_date)}`}
          </p>
          {selectedProgram.notes && (
            <p className="program-summary-notes">{selectedProgram.notes}</p>
          )}
        </div>
        <div className="program-summary-actions">
          {selectedProgram.status !== "active" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleActivate(selectedProgram)}
              disabled={busy}
            >
              {actionKey === `activate-${selectedProgram.id}`
                ? "מפעיל..."
                : "הפעל תוכנית"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => beginEditProgram(selectedProgram)}
            disabled={busy}
          >
            ערוך פרטי תוכנית
          </button>
          <button
            type="button"
            className="btn btn-sm program-action-danger"
            onClick={() => handleDeleteProgram(selectedProgram)}
            disabled={busy}
          >
            {actionKey === `delete-${selectedProgram.id}` ? "מוחק..." : "מחק תוכנית"}
          </button>
        </div>
      </section>

      {actionError && !formOpen && (
        <div className="alert-strip danger">{actionError}</div>
      )}

      <div className="program-days-header">
        <h3>
          סוגי אימון
          {!detailsLoading && !detailsError && <span>{days.length}</span>}
        </h3>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={beginCreateDay}
          disabled={busy}
        >
          + סוג אימון
        </button>
      </div>

      {showDayForm && !editingDayId && renderDayForm()}

      {detailsLoading ? (
        <div className="card programs-empty-state">טוען את פרטי התוכנית...</div>
      ) : detailsError ? (
        <div className="alert-strip danger">{detailsError}</div>
      ) : days.length === 0 ? (
        <div className="card programs-empty-state">
          אין סוגי אימון בתוכנית. הוסף את האימון הראשון.
        </div>
      ) : (
        days.map((day) => (
          <section className="program-day" key={day.id}>
            {showDayForm && editingDayId === day.id ? (
              renderDayForm()
            ) : (
              <header className="program-day-header">
                <span className="program-day-number">{day.day_order}</span>
                <div className="program-day-title">
                  <h4>{day.name}</h4>
                  <small>
                    {exerciseCountLabel(day.exercises.length)}
                    {day.notes ? ` · ${day.notes}` : ""}
                  </small>
                </div>
                <div className="program-day-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => beginEditDay(day)}
                    disabled={busy}
                    aria-label={`ערוך סוג אימון ${day.name}`}
                  >
                    ערוך
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm program-action-danger"
                    onClick={() => handleDeleteDay(day)}
                    disabled={busy}
                    aria-label={`מחק סוג אימון ${day.name}`}
                  >
                    מחק
                  </button>
                </div>
              </header>
            )}

            <div className="program-exercises">
              {day.exercises.length === 0 && exerciseDayId !== day.id && (
                <div className="program-exercises-empty">
                  אין עדיין תרגילים בסוג האימון הזה.
                </div>
              )}
              {day.exercises.map((exercise, exerciseIndex) =>
                exerciseDayId === day.id && editingExerciseId === exercise.id ? (
                  <div key={exercise.id}>{renderExerciseForm(day)}</div>
                ) : (
                  renderExerciseRow(day, exercise, exerciseIndex)
                )
              )}
              {exerciseDayId === day.id && !editingExerciseId ? (
                renderExerciseForm(day)
              ) : (
                <button
                  type="button"
                  className="program-add-exercise"
                  onClick={() => beginCreateExercise(day)}
                  disabled={busy}
                >
                  + הוספת תרגיל
                </button>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
