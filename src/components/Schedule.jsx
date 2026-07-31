import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTrainees } from "../services/traineesService.js";
import {
  createSession,
  deleteSession,
  fetchSessions,
  updateSession,
  updateSessionStatus,
} from "../services/sessionsService.js";

const DAY_START = 6;
const DAY_END = 22;
const SLOT_HEIGHT = 58;
const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const STATUS_OPTIONS = ["מתוכנן", "הושלם", "בוטל", "דורש תיאום"];
const TRAINING_TYPE_OPTIONS = ["אישי", "אונליין", "קבוצתי"];
const LOCATION_PRESETS = ["סטודיו", "בית המתאמן", "אונליין"];

function emptyForm() {
  return {
    traineeId: "",
    date: "",
    startTime: "",
    durationMinutes: "60",
    trainingType: "אישי",
    location: "",
    status: "מתוכנן",
    notes: "",
  };
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  return new Date(`${value}T12:00:00`);
}

function startOfWeek(value) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutes(time, amount) {
  const total = toMinutes(time) + Number(amount);
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatShortDate(value) {
  return dateFromKey(value).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatLongDate(value) {
  return dateFromKey(value).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatWeekRange(weekDays) {
  const first = weekDays[0];
  const last = weekDays[6];
  const sameMonth = first.getMonth() === last.getMonth();
  if (sameMonth) {
    return `${first.getDate()}–${last.getDate()} ${last.toLocaleDateString("he-IL", {
      month: "long",
      year: "numeric",
    })}`;
  }
  return `${first.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  })} – ${last.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function sessionKind(session) {
  const location = session.location.toLowerCase();
  if (session.status === "בוטל" || location.includes("חסום")) return "blocked";
  if (location.includes("בית")) return "home";
  if (location.includes("אונליין")) return "online";
  return "studio";
}

function mapSession(row, trainees) {
  const trainee = trainees.find((item) => item.id === row.trainee_id);
  return {
    id: row.id,
    traineeId: row.trainee_id,
    traineeName: trainee?.full_name || "מתאמן לא ידוע",
    date: row.session_date,
    startTime: row.start_time?.slice(0, 5) || "",
    durationMinutes: row.duration_minutes,
    trainingType: row.training_type,
    location: row.location,
    status: row.status,
    notes: row.notes ?? "",
    createdAt: row.created_at,
  };
}

function hasOverlap(date, startTime, duration, sessions, ignoredId = null) {
  const start = toMinutes(startTime);
  const end = start + Number(duration);
  return sessions.some((session) => {
    if (session.id === ignoredId || session.date !== date || session.status === "בוטל") {
      return false;
    }
    const sessionStart = toMinutes(session.startTime);
    const sessionEnd = sessionStart + Number(session.durationMinutes);
    return start < sessionEnd && end > sessionStart;
  });
}

export default function Schedule() {
  const [sessions, setSessions] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rowActionId, setRowActionId] = useState(null);
  const [rowError, setRowError] = useState("");
  const actionLockRef = useRef(false);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const weekKeys = useMemo(() => weekDays.map(localDateKey), [weekDays]);
  const todayKey = localDateKey(new Date());
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, index) => DAY_START + index);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [traineeRows, sessionRows] = await Promise.all([
        fetchTrainees(),
        fetchSessions(),
      ]);
      setTrainees(traineeRows);
      setSessions(sessionRows.map((row) => mapSession(row, traineeRows)));
    } catch (error) {
      console.error("Schedule fetch error:", error);
      setLoadError("לא ניתן לטעון את לוח הזמנים כרגע.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [traineeRows, sessionRows] = await Promise.all([
          fetchTrainees(),
          fetchSessions(),
        ]);
        if (!active) return;
        setTrainees(traineeRows);
        setSessions(sessionRows.map((row) => mapSession(row, traineeRows)));
      } catch (error) {
        console.error("Schedule fetch error:", error);
        if (active) setLoadError("לא ניתן לטעון את לוח הזמנים כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const weekSessions = useMemo(
    () =>
      sessions
        .filter((session) => weekKeys.includes(session.date))
        .sort((a, b) =>
          a.date === b.date
            ? a.startTime.localeCompare(b.startTime)
            : a.date.localeCompare(b.date)
        ),
    [sessions, weekKeys]
  );

  const futureSessions = useMemo(
    () =>
      [...sessions]
        .filter((session) => session.date >= todayKey)
        .sort((a, b) =>
          a.date === b.date
            ? a.startTime.localeCompare(b.startTime)
            : a.date.localeCompare(b.date)
        ),
    [sessions, todayKey]
  );

  function openCreate(date = todayKey, startTime = "08:00") {
    if (saving || rowActionId) return;
    setEditingSessionId(null);
    setForm({
      ...emptyForm(),
      date,
      startTime,
    });
    setFormError("");
    setRowError("");
    setShowForm(true);
  }

  function openEdit(session) {
    if (saving || rowActionId) return;
    setEditingSessionId(session.id);
    setForm({
      traineeId: session.traineeId,
      date: session.date,
      startTime: session.startTime,
      durationMinutes: String(session.durationMinutes),
      trainingType: session.trainingType,
      location: session.location,
      status: session.status,
      notes: session.notes,
    });
    setFormError("");
    setRowError("");
    setShowForm(true);
  }

  function closeForm(force = false) {
    if (saving && !force) return;
    setShowForm(false);
    setEditingSessionId(null);
    setForm(emptyForm());
    setFormError("");
  }

  function handleField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (actionLockRef.current || saving || rowActionId) return;

    const duration = Number(form.durationMinutes);
    const location = form.location.trim();
    if (!form.traineeId || !form.date || !form.startTime || !duration || !location) {
      setFormError("מתאמן, תאריך, שעת התחלה, משך ומיקום הם שדות חובה.");
      return;
    }
    if (duration <= 0) {
      setFormError("משך האימון חייב להיות גדול מאפס.");
      return;
    }
    if (hasOverlap(form.date, form.startTime, duration, sessions, editingSessionId)) {
      setFormError("קיים אימון חופף בזמן שנבחר.");
      return;
    }

    actionLockRef.current = true;
    setSaving(true);
    setFormError("");
    const payload = {
      traineeId: form.traineeId,
      date: form.date,
      startTime: form.startTime,
      durationMinutes: duration,
      trainingType: form.trainingType,
      location,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      if (editingSessionId) {
        const row = await updateSession(editingSessionId, payload);
        const updated = mapSession(row, trainees);
        setSessions((current) =>
          current.map((session) => (session.id === editingSessionId ? updated : session))
        );
      } else {
        const row = await createSession(payload);
        setSessions((current) => [...current, mapSession(row, trainees)]);
      }
      closeForm(true);
    } catch (error) {
      console.error(
        editingSessionId ? "Session update error:" : "Session create error:",
        error
      );
      setFormError(
        editingSessionId
          ? "לא ניתן לשמור את השינויים. נסה שוב."
          : "לא ניתן ליצור את האימון. נסה שוב."
      );
    } finally {
      actionLockRef.current = false;
      setSaving(false);
    }
  }

  async function handleStatusChange(id, status) {
    if (actionLockRef.current || saving || rowActionId) return;
    actionLockRef.current = true;
    setRowActionId(id);
    setRowError("");
    try {
      const row = await updateSessionStatus(id, status);
      const updated = mapSession(row, trainees);
      setSessions((current) =>
        current.map((session) => (session.id === id ? updated : session))
      );
    } catch (error) {
      console.error("Session status update error:", error);
      setRowError("לא ניתן לעדכן את סטטוס האימון.");
    } finally {
      actionLockRef.current = false;
      setRowActionId(null);
    }
  }

  async function handleDelete(id) {
    if (actionLockRef.current || saving || rowActionId) return;
    if (!window.confirm("למחוק את האימון?")) return;

    actionLockRef.current = true;
    setRowActionId(id);
    setRowError("");
    try {
      await deleteSession(id);
      setSessions((current) => current.filter((session) => session.id !== id));
      if (editingSessionId === id) closeForm();
    } catch (error) {
      console.error("Session delete error:", error);
      setRowError("לא ניתן למחוק את האימון.");
    } finally {
      actionLockRef.current = false;
      setRowActionId(null);
    }
  }

  function eventStyle(session) {
    const start = toMinutes(session.startTime);
    const visibleStart = Math.max(start, DAY_START * 60);
    const visibleEnd = Math.min(
      start + Number(session.durationMinutes),
      DAY_END * 60
    );
    return {
      top: ((visibleStart - DAY_START * 60) / 60) * SLOT_HEIGHT + 2,
      height: Math.max(((visibleEnd - visibleStart) / 60) * SLOT_HEIGHT - 4, 34),
    };
  }

  if (loading) {
    return <div className="empty-state">טוען את לוח הזמנים...</div>;
  }

  if (loadError) {
    return (
      <div className="schedule-load-error card">
        <p>{loadError}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={loadData}>
          נסה שוב
        </button>
      </div>
    );
  }

  const actionsLocked = saving || rowActionId !== null;

  return (
    <div className="schedule-page">
      <header className="schedule-page-header">
        <div>
          <h2>לוח זמנים</h2>
          <p>ניהול שבועי של אימונים, מיקומים וזמינות</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openCreate()}
          disabled={actionsLocked}
        >
          + אימון חדש
        </button>
      </header>

      <section className="schedule-toolbar card">
        <div className="schedule-navigation">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setWeekStart((current) => addDays(current, -7))}
          >
            השבוע הקודם →
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            היום
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setWeekStart((current) => addDays(current, 7))}
          >
            ← השבוע הבא
          </button>
        </div>
        <strong>{formatWeekRange(weekDays)}</strong>
        <div className="schedule-legend" aria-label="מקרא">
          <span><i className="studio" />סטודיו</span>
          <span><i className="home" />בית המתאמן</span>
          <span><i className="online" />אונליין</span>
          <span><i className="blocked" />בוטל / חסום</span>
        </div>
      </section>

      {rowError && <div className="schedule-error-strip">{rowError}</div>}

      <section className="schedule-calendar card">
        <div className="schedule-calendar-scroll">
          <div className="schedule-week-grid">
            <div className="schedule-time-heading">שעה</div>
            {weekDays.map((day, index) => {
              const key = localDateKey(day);
              return (
                <div
                  className={`schedule-day-heading ${key === todayKey ? "today" : ""}`}
                  key={key}
                >
                  <span>יום {DAY_NAMES[index]}</span>
                  <strong>{formatShortDate(key)}</strong>
                </div>
              );
            })}

            <div className="schedule-time-column">
              {hours.map((hour) => (
                <div className="schedule-time-label" key={hour}>
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const date = localDateKey(day);
              const daySessions = weekSessions.filter((session) => session.date === date);
              return (
                <div
                  className={`schedule-day-column ${date === todayKey ? "today" : ""}`}
                  key={date}
                >
                  {hours.map((hour) => {
                    const time = `${String(hour).padStart(2, "0")}:00`;
                    return (
                      <button
                        type="button"
                        className="schedule-empty-slot"
                        onClick={() => openCreate(date, time)}
                        aria-label={`הוסף אימון ב-${formatLongDate(date)} בשעה ${time}`}
                        key={time}
                      />
                    );
                  })}
                  <div className="schedule-events-layer">
                    {daySessions.map((session) => (
                      <button
                        type="button"
                        className={`schedule-event ${sessionKind(session)}`}
                        style={eventStyle(session)}
                        onClick={() => openEdit(session)}
                        title={`${session.traineeName}, ${session.startTime}, ${session.location}`}
                        key={session.id}
                      >
                        <strong>{session.startTime} · {session.traineeName}</strong>
                        <span>{session.location}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="schedule-list-section">
        <div className="schedule-section-title">
          <div>
            <h3>כל האימונים הקרובים</h3>
            <p>{futureSessions.length} אימונים מהיום והלאה</p>
          </div>
        </div>
        {futureSessions.length === 0 ? (
          <div className="card empty-state">אין אימונים קרובים.</div>
        ) : (
          <div className="schedule-session-list card">
            {futureSessions.map((session) => {
              const busy = rowActionId === session.id;
              return (
                <article
                  className={`schedule-session-row ${busy ? "busy" : ""}`}
                  key={session.id}
                >
                  <button
                    type="button"
                    className="schedule-session-main"
                    onClick={() => openEdit(session)}
                    disabled={actionsLocked}
                  >
                    <span className={`schedule-kind-dot ${sessionKind(session)}`} />
                    <span>
                      <strong>{session.traineeName}</strong>
                      <small>
                        {formatLongDate(session.date)} · {session.startTime}–
                        {addMinutes(session.startTime, session.durationMinutes)}
                      </small>
                    </span>
                  </button>
                  <span className="schedule-session-location">{session.location}</span>
                  <select
                    className="form-select schedule-status-select"
                    value={session.status}
                    onChange={(event) =>
                      handleStatusChange(session.id, event.target.value)
                    }
                    disabled={actionsLocked}
                    aria-label={`סטטוס האימון של ${session.traineeName}`}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <div className="schedule-row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEdit(session)}
                      disabled={actionsLocked}
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(session.id)}
                      disabled={actionsLocked}
                    >
                      מחיקה
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showForm && (
        <div className="modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <form className="modal modal-lg schedule-form-modal" onSubmit={handleSave}>
            <div className="schedule-form-head">
              <div>
                <h3 className="modal-title">
                  {editingSessionId ? "עריכת אימון" : "אימון חדש"}
                </h3>
                {form.date && form.startTime && (
                  <p>{formatLongDate(form.date)} · {form.startTime}</p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeForm}
                disabled={saving}
                aria-label="סגור"
              >
                ✕
              </button>
            </div>

            <div className="schedule-form-grid">
              <label className="form-group schedule-form-wide">
                <span className="form-label">מתאמן *</span>
                <select
                  className="form-select"
                  value={form.traineeId}
                  onChange={(event) => handleField("traineeId", event.target.value)}
                  disabled={saving}
                >
                  <option value="">בחר מתאמן</option>
                  {trainees.map((trainee) => (
                    <option value={trainee.id} key={trainee.id}>
                      {trainee.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-group">
                <span className="form-label">תאריך *</span>
                <input
                  className="form-input"
                  type="date"
                  value={form.date}
                  onChange={(event) => handleField("date", event.target.value)}
                  disabled={saving}
                />
              </label>
              <label className="form-group">
                <span className="form-label">שעת התחלה *</span>
                <input
                  className="form-input"
                  type="time"
                  value={form.startTime}
                  onChange={(event) => handleField("startTime", event.target.value)}
                  disabled={saving}
                />
              </label>
              <label className="form-group">
                <span className="form-label">משך בדקות *</span>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  step="5"
                  value={form.durationMinutes}
                  onChange={(event) =>
                    handleField("durationMinutes", event.target.value)
                  }
                  disabled={saving}
                />
              </label>
              <label className="form-group">
                <span className="form-label">סוג אימון</span>
                <select
                  className="form-select"
                  value={form.trainingType}
                  onChange={(event) =>
                    handleField("trainingType", event.target.value)
                  }
                  disabled={saving}
                >
                  {TRAINING_TYPE_OPTIONS.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label className="form-group schedule-form-wide">
                <span className="form-label">מיקום / כתובת *</span>
                <input
                  className="form-input"
                  list="schedule-location-presets"
                  value={form.location}
                  onChange={(event) => handleField("location", event.target.value)}
                  placeholder="לדוגמה: סטודיו או כתובת בית המתאמן"
                  disabled={saving}
                />
                <datalist id="schedule-location-presets">
                  {LOCATION_PRESETS.map((location) => (
                    <option value={location} key={location} />
                  ))}
                </datalist>
              </label>

              <label className="form-group schedule-form-wide">
                <span className="form-label">סטטוס</span>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(event) => handleField("status", event.target.value)}
                  disabled={saving}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="form-group schedule-form-wide">
                <span className="form-label">הערות</span>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={form.notes}
                  onChange={(event) => handleField("notes", event.target.value)}
                  disabled={saving}
                />
              </label>
            </div>

            {formError && <div className="schedule-form-error">{formError}</div>}

            <div className="schedule-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionsLocked}
              >
                {saving
                  ? "שומר..."
                  : editingSessionId
                    ? "שמור שינויים"
                    : "צור אימון"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeForm}
                disabled={saving}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
