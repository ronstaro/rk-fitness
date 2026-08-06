import { useEffect, useRef, useState } from "react";
import { fetchTrainees, createTrainee, updateTrainee, updateTraineeStatus, deleteTrainee } from "./services/traineesService.js";
import { fetchSessions } from "./services/sessionsService.js";
import { fetchActivePrograms } from "./services/programsService.js";
import { fetchTraineeHomeData, fetchTraineeProfile, fetchTraineeProgramData } from "./services/traineeHomeService.js";
import { fetchCompletedWorkouts, fetchOpenWorkout, finishWorkout, startWorkout, updateWorkoutExercise, updateWorkoutSet, uploadExerciseVideo } from "./services/workoutExecutionService.js";
import Dashboard from "./components/Dashboard.jsx";
import Finance from "./components/Finance.jsx";
import Leads from "./components/Leads.jsx";
import Programs from "./components/Programs.jsx";
import Schedule from "./components/Schedule.jsx";
import WeeklyGoals from "./components/WeeklyGoals.jsx";

function whatsappLink(phone) {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`;
  }

  return `https://wa.me/${digits}`;
}

function Trainees({ onOpenPrograms }) {
  const STORAGE_KEY = "rk-fitness-trainees";
  const emptyTraineeForm = () => ({
    fullName: "",
    phone: "",
    birthDate: "",
    startDate: "",
    trainingType: "אישי",
    status: "פעיל",
    mainGoal: "",
    successMetric: "",
    notes: "",
    packageName: "",
    packagePrice: "",
    paymentMethod: "",
    paymentStatus: "",
    nextPaymentDate: "",
  });

  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hasLoadedTrainees, setHasLoadedTrainees] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("הכל");
  const [form, setForm] = useState(emptyTraineeForm);
  const [editingTraineeId, setEditingTraineeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rowActionId, setRowActionId] = useState(null);
  const [rowError, setRowError] = useState("");
  const [activeProgramsByTrainee, setActiveProgramsByTrainee] = useState({});
  const [sessions, setSessions] = useState([]);
  const [selectedTraineeId, setSelectedTraineeId] = useState("");
  const actionLockRef = useRef(false);

  async function handleRetry() {
    setLoading(true);
    setLoadError("");

    try {
      const [traineeRows, activePrograms, sessionRows] = await Promise.all([
        fetchTrainees(),
        fetchActivePrograms(),
        fetchSessions(),
      ]);
      setTrainees(traineeRows);
      setSessions(sessionRows);
      setActiveProgramsByTrainee(
        Object.fromEntries(
          activePrograms.map((program) => [program.trainee_id, program])
        )
      );
      setHasLoadedTrainees(true);
    } catch (err) {
      console.error("Trainees fetch error:", err);
      setLoadError("לא ניתן לטעון את המתאמנים כרגע.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [traineeRows, activePrograms, sessionRows] = await Promise.all([
          fetchTrainees(),
          fetchActivePrograms(),
          fetchSessions(),
        ]);
        if (active) {
          setTrainees(traineeRows);
          setSessions(sessionRows);
          setActiveProgramsByTrainee(
            Object.fromEntries(
              activePrograms.map((program) => [program.trainee_id, program])
            )
          );
          setLoadError("");
          setHasLoadedTrainees(true);
        }
      } catch (err) {
        console.error("Trainees fetch error:", err);
        if (active) {
          setLoadError("לא ניתן לטעון את המתאמנים כרגע.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedTrainees) return;

    // Keep the legacy localStorage mirror for backward compatibility.
    // Schedule now reads trainees directly from Supabase.
    const legacyShape = trainees.map((t) => ({
      id: t.id,
      fullName: t.full_name,
      phone: t.phone,
      birthDate: t.birth_date,
      startDate: t.start_date,
      trainingType: t.training_type,
      status: t.status,
      mainGoal: t.main_goal,
      successMetric: t.success_metric,
      notes: t.notes,
      createdAt: t.created_at,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyShape));
  }, [hasLoadedTrainees, trainees]);

  function handleField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (actionLockRef.current || saving || rowActionId) return;

    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const startDate = form.startDate.trim();
    const mainGoal = form.mainGoal.trim();
    if (!fullName || !phone || !startDate || !mainGoal) {
      setFormError("שם מלא, טלפון, תאריך התחלה ויעד מרכזי הם שדות חובה");
      return;
    }

    actionLockRef.current = true;
    setSaving(true);
    setFormError("");

    const payload = {
      full_name: fullName,
      phone,
      birth_date: form.birthDate || null,
      start_date: startDate,
      training_type: form.trainingType,
      status: form.status,
      main_goal: mainGoal,
      success_metric: form.successMetric.trim() || null,
      notes: form.notes.trim() || null,
      package_name: form.packageName.trim() || null,
      package_price: form.packagePrice === "" ? null : Number(form.packagePrice),
      payment_method: form.paymentMethod || null,
      payment_status: form.paymentStatus || null,
      next_payment_date: form.nextPaymentDate || null,
    };

    try {
      if (editingTraineeId) {
        const row = await updateTrainee(editingTraineeId, payload);
        setTrainees((prev) =>
          prev.map((t) => (t.id === editingTraineeId ? row : t))
        );
      } else {
        const row = await createTrainee(payload);
        setTrainees((prev) => [row, ...prev]);
      }

      setForm(emptyTraineeForm());
      setEditingTraineeId(null);
      setShowForm(false);
    } catch (err) {
      console.error(editingTraineeId ? "Trainee update error:" : "Trainee create error:", err);
      setFormError(editingTraineeId ? "לא ניתן לשמור את השינויים. נסה שוב." : "לא ניתן לשמור את המתאמן. נסה שוב.");
    } finally {
      actionLockRef.current = false;
      setSaving(false);
    }
  }

  function handleEdit(trainee) {
    if (actionLockRef.current || saving || rowActionId) return;

    setEditingTraineeId(trainee.id);
    setForm({
      fullName: trainee.full_name,
      phone: trainee.phone,
      birthDate: trainee.birth_date || "",
      startDate: trainee.start_date,
      trainingType: trainee.training_type,
      status: trainee.status,
      mainGoal: trainee.main_goal,
      successMetric: trainee.success_metric || "",
      notes: trainee.notes || "",
      packageName: trainee.package_name || "",
      packagePrice: trainee.package_price ?? "",
      paymentMethod: trainee.payment_method || "",
      paymentStatus: trainee.payment_status || "",
      nextPaymentDate: trainee.next_payment_date || "",
    });
    setShowForm(true);
    setFormError("");
  }

  async function handleStatusChange(id, newStatus) {
    if (actionLockRef.current || saving || rowActionId) return;

    actionLockRef.current = true;
    setRowActionId(id);
    setRowError("");

    try {
      const updated = await updateTraineeStatus(id, newStatus);
      setTrainees((prev) =>
        prev.map((t) => (t.id === id ? updated : t))
      );
    } catch (err) {
      console.error("Trainee status update error:", err);
      setRowError("לא ניתן לעדכן את הסטטוס.");
    } finally {
      actionLockRef.current = false;
      setRowActionId(null);
    }
  }

  async function handleDelete(id) {
    if (actionLockRef.current || saving || rowActionId) return;

    if (!window.confirm("למחוק את המתאמן לצמיתות? האימונים ותוכניות האימון המקושרים יימחקו. היסטוריית הכספים תישמר ללא קישור למתאמן.")) {
      return;
    }

    actionLockRef.current = true;
    setRowActionId(id);
    setRowError("");

    try {
      await deleteTrainee(id);
      setTrainees((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Trainee delete error:", err);
      setRowError("לא ניתן למחוק את המתאמן.");
    } finally {
      actionLockRef.current = false;
      setRowActionId(null);
    }
  }

  function trainingYears(startDate) {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    const m = now.getMonth() - start.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years--;
    return years;
  }

  const actionsLocked = saving || rowActionId !== null;

  const filteredTrainees = filter === "אונליין"
    ? trainees.filter((t) => t.training_type === "אונליין")
    : filter === "אישי"
    ? trainees.filter((t) => t.training_type === "אישי")
    : trainees;

  const statusOptions = ["פעיל", "בהקפאה", "דורש מעקב", "הסתיים"];
  const trainingTypeOptions = ["אישי", "אונליין", "קבוצתי"];
  const paymentMethodOptions = ["אשראי", "העברה בנקאית", "Bit", "מזומן", "אחר"];
  const paymentStatusOptions = ["שולם", "ממתין לתשלום", "באיחור"];
  const selectedTrainee = trainees.find((trainee) => trainee.id === selectedTraineeId);

  function initials(fullName) {
    return fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("");
  }

  function formatDate(value) {
    if (!value) return "לא הוזן";
    return new Date(`${value}T12:00:00`).toLocaleDateString("he-IL");
  }

  function ageFromBirthDate(value) {
    if (!value) return null;
    const birthDate = new Date(`${value}T12:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }
    return age;
  }

  function formatPrice(value) {
    if (value === null || value === undefined || value === "") return "לא הוזן";
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  function remainingProgramDays(endDate) {
    if (!endDate) return "לא הוגדר";
    const end = new Date(`${endDate}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const days = Math.ceil((end - today) / 86400000);
    if (days < 0) return "הסתיימה";
    if (days === 0) return "היום";
    return `${days} ימים`;
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function sessionStats(traineeId) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setHours(12, 0, 0, 0);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const monthStart = new Date(today);
    monthStart.setHours(12, 0, 0, 0);
    monthStart.setDate(today.getDate() - 29);

    const traineeSessions = sessions.filter(
      (session) => session.trainee_id === traineeId && session.status !== "בוטל"
    );
    const weekly = traineeSessions.filter(
      (session) =>
        session.session_date >= localDateKey(weekStart) &&
        session.session_date <= localDateKey(weekEnd)
    );
    const lastThirtyDays = traineeSessions.filter(
      (session) =>
        session.session_date >= localDateKey(monthStart) &&
        session.session_date <= localDateKey(today)
    );
    const weeklyCompleted = weekly.filter(
      (session) => session.status === "הושלם"
    ).length;
    const monthlyCompleted = lastThirtyDays.filter(
      (session) => session.status === "הושלם"
    ).length;

    return {
      weeklyPlanned: weekly.length,
      weeklyCompleted,
      weeklyPercent:
        weekly.length === 0 ? 0 : Math.round((weeklyCompleted / weekly.length) * 100),
      monthlyPlanned: lastThirtyDays.length,
      monthlyCompleted,
      monthlyPercent:
        lastThirtyDays.length === 0
          ? 0
          : Math.round((monthlyCompleted / lastThirtyDays.length) * 100),
    };
  }

  function statusClass(status) {
    if (status === "פעיל") return "badge-active";
    if (status === "דורש מעקב") return "badge-danger";
    if (status === "בהקפאה") return "badge-warn";
    return "badge-inactive";
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#9E9A90" }}>
        טוען מתאמנים...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ color: "#C0392B", marginBottom: 12 }}>
          {loadError}
        </div>
        <button
          onClick={handleRetry}
          style={{
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#7C2D3E",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          נסה שוב
        </button>
      </div>
    );
  }

  if (selectedTrainee) {
    const activeProgram = activeProgramsByTrainee[selectedTrainee.id];
    const stats = sessionStats(selectedTrainee.id);
    const age = ageFromBirthDate(selectedTrainee.birth_date);
    const years = trainingYears(selectedTrainee.start_date);
    const busy = rowActionId === selectedTrainee.id;

    return (
      <div className="trainee-profile slide-in">
        <button
          type="button"
          className="btn btn-ghost btn-sm trainee-back-button"
          onClick={() => setSelectedTraineeId("")}
        >
          → חזרה למתאמנים
        </button>

        <section className="trainee-profile-hero">
          <div className="trainee-profile-identity">
            <div className="avatar avatar-lg">{initials(selectedTrainee.full_name)}</div>
            <div>
              <h2>{selectedTrainee.full_name}</h2>
              <div className="trainee-card-badges">
                <span className={`badge ${statusClass(selectedTrainee.status)}`}>
                  {selectedTrainee.status}
                </span>
                <span className="badge badge-new">{selectedTrainee.training_type}</span>
                {activeProgram && <span className="badge badge-burg">תוכנית פעילה</span>}
                {years >= 1 && (
                  <span className="badge badge-mustard">
                    {years === 1 ? "שנת אימונים" : `${years} שנות אימונים`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="trainee-profile-actions">
            {selectedTrainee.phone && (
              <a
                href={whatsappLink(selectedTrainee.phone)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-whatsapp btn-sm"
              >
                WhatsApp
              </a>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleEdit(selectedTrainee)}
              disabled={actionsLocked}
            >
              עריכה
            </button>
            <select
              value={selectedTrainee.status}
              onChange={(event) =>
                handleStatusChange(selectedTrainee.id, event.target.value)
              }
              disabled={actionsLocked}
              className="form-select trainee-status-select"
              aria-label="סטטוס מתאמן"
            >
              {statusOptions.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </section>

        {selectedTrainee.status === "דורש מעקב" && (
          <div className="alert-strip danger">
            נדרש מעקב מול המתאמן. כדאי לבדוק את האימונים האחרונים וההערות.
          </div>
        )}

        {rowError && <div className="alert-strip danger">{rowError}</div>}

        {showForm && editingTraineeId === selectedTrainee.id && (
          <section className="card trainee-edit-card">
            <div className="section-title">✏️ עריכת מתאמן</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">שם מלא *</label>
                <input className="form-input" value={form.fullName} onChange={(event) => handleField("fullName", event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">טלפון *</label>
                <input className="form-input" value={form.phone} onChange={(event) => handleField("phone", event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">תאריך לידה</label>
                <input className="form-input" type="date" value={form.birthDate} onChange={(event) => handleField("birthDate", event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">תאריך התחלה *</label>
                <input className="form-input" type="date" value={form.startDate} onChange={(event) => handleField("startDate", event.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">סוג אימון</label>
                <select className="form-select" value={form.trainingType} onChange={(event) => handleField("trainingType", event.target.value)}>
                  {trainingTypeOptions.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">יעד מרכזי *</label>
                <input className="form-input" value={form.mainGoal} onChange={(event) => handleField("mainGoal", event.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">מדד הצלחה</label>
              <input className="form-input" value={form.successMetric} onChange={(event) => handleField("successMetric", event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">הערות</label>
              <textarea className="form-textarea" value={form.notes} onChange={(event) => handleField("notes", event.target.value)} />
            </div>
            <div className="section-title">💳 חבילה ותשלום</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">שם החבילה</label>
                <input className="form-input" value={form.packageName} onChange={(event) => handleField("packageName", event.target.value)} placeholder="למשל: 10 אימונים אישיים" />
              </div>
              <div className="form-group">
                <label className="form-label">מחיר החבילה</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.packagePrice} onChange={(event) => handleField("packagePrice", event.target.value)} placeholder="₪" />
              </div>
              <div className="form-group">
                <label className="form-label">שיטת תשלום</label>
                <select className="form-select" value={form.paymentMethod} onChange={(event) => handleField("paymentMethod", event.target.value)}>
                  <option value="">לא הוגדר</option>
                  {paymentMethodOptions.map((method) => <option key={method}>{method}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">סטטוס תשלום</label>
                <select className="form-select" value={form.paymentStatus} onChange={(event) => handleField("paymentStatus", event.target.value)}>
                  <option value="">לא הוגדר</option>
                  {paymentStatusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">תשלום הבא</label>
                <input className="form-input" type="date" value={form.nextPaymentDate} onChange={(event) => handleField("nextPaymentDate", event.target.value)} />
              </div>
            </div>
            {formError && <div className="alert-strip danger">{formError}</div>}
            <div className="flex-gap">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={actionsLocked}>
                {saving ? "שומר..." : "שמור שינויים"}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowForm(false); setEditingTraineeId(null); setFormError(""); }} disabled={saving}>
                ביטול
              </button>
            </div>
          </section>
        )}

        <div className="trainee-profile-grid">
          <div className="trainee-profile-column">
            <section className="card trainee-detail-card">
              <div className="section-title">👤 פרטים אישיים</div>
              <div className="trainee-detail-list">
                <div><span className="trainee-detail-icon">📞</span><span><small>טלפון</small><strong>{selectedTrainee.phone || "לא הוזן"}</strong></span></div>
                <div><span className="trainee-detail-icon">🎂</span><span><small>גיל</small><strong>{age ?? "לא הוזן"}</strong></span></div>
                <div><span className="trainee-detail-icon">📅</span><span><small>תאריך לידה</small><strong>{formatDate(selectedTrainee.birth_date)}</strong></span></div>
                <div><span className="trainee-detail-icon">🏁</span><span><small>תחילת אימון</small><strong>{formatDate(selectedTrainee.start_date)}</strong></span></div>
                <div><span className="trainee-detail-icon">🏋️</span><span><small>מסלול</small><strong>{selectedTrainee.training_type}</strong></span></div>
                <div><span className="trainee-detail-icon">🎯</span><span><small>יעד מרכזי</small><strong>{selectedTrainee.main_goal || "לא הוזן"}</strong></span></div>
                <div><span className="trainee-detail-icon">📈</span><span><small>מדד הצלחה</small><strong>{selectedTrainee.success_metric || "לא הוזן"}</strong></span></div>
              </div>
            </section>

            <section className="card trainee-detail-card">
              <div className="section-title">💳 חבילה ותשלום</div>
              <div className="trainee-detail-list">
                <div><span className="trainee-detail-icon">📦</span><span><small>חבילה</small><strong>{selectedTrainee.package_name || "לא הוזן"}</strong></span></div>
                <div><span className="trainee-detail-icon">💰</span><span><small>מחיר</small><strong>{formatPrice(selectedTrainee.package_price)}</strong></span></div>
                <div><span className="trainee-detail-icon">💳</span><span><small>שיטת תשלום</small><strong>{selectedTrainee.payment_method || "לא הוזן"}</strong></span></div>
                <div><span className="trainee-detail-icon">✅</span><span><small>סטטוס</small><strong>{selectedTrainee.payment_status || "לא הוזן"}</strong></span></div>
                <div><span className="trainee-detail-icon">🗓️</span><span><small>תשלום הבא</small><strong>{formatDate(selectedTrainee.next_payment_date)}</strong></span></div>
              </div>
            </section>
          </div>

          <div className="trainee-profile-column">
            <section className="card trainee-detail-card">
              <div className="section-title">📋 תוכנית אימון</div>
              {activeProgram ? (
                <>
                  <div className="trainee-program-name">{activeProgram.name}</div>
                  <dl className="trainee-detail-list mt-16">
                    <div><dt>מטרת התוכנית</dt><dd>{activeProgram.goal || "לא הוזנה"}</dd></div>
                    <div><dt>התחלה</dt><dd>{formatDate(activeProgram.start_date)}</dd></div>
                    <div><dt>סיום</dt><dd>{formatDate(activeProgram.end_date)}</dd></div>
                    <div><dt>משך</dt><dd>{activeProgram.duration_weeks ? `${activeProgram.duration_weeks} שבועות` : "לא הוגדר"}</dd></div>
                    <div><dt>אימונים בשבוע</dt><dd>{activeProgram.sessions_per_week || "לא הוגדר"}</dd></div>
                    <div><dt>ימים שנותרו</dt><dd>{remainingProgramDays(activeProgram.end_date)}</dd></div>
                  </dl>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-16"
                    onClick={() => onOpenPrograms(selectedTrainee.id)}
                  >
                    פתח תוכנית
                  </button>
                </>
              ) : (
                <>
                  <div className="trainee-unavailable-state">אין תוכנית פעילה.</div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mt-16"
                    onClick={() => onOpenPrograms(selectedTrainee.id)}
                  >
                    צור תוכנית
                  </button>
                </>
              )}
            </section>

            <section className="card trainee-detail-card">
              <div className="section-title">📈 התקדמות</div>
              <div className="trainee-progress-row">
                <div className="flex-between">
                  <span className="muted text-sm">השלמה שבועית</span>
                  <strong>{stats.weeklyCompleted}/{stats.weeklyPlanned}</strong>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${stats.weeklyPercent >= 75 ? "green" : stats.weeklyPercent >= 40 ? "warn" : "danger"}`}
                    style={{ width: `${stats.weeklyPercent}%` }}
                  />
                </div>
              </div>
              <div className="trainee-progress-row">
                <div className="flex-between">
                  <span className="muted text-sm">עקביות ב־30 הימים האחרונים</span>
                  <strong>
                    {stats.monthlyPlanned === 0 ? "אין נתונים" : `${stats.monthlyPercent}%`}
                  </strong>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${stats.monthlyPercent >= 75 ? "green" : stats.monthlyPercent >= 40 ? "warn" : "danger"}`}
                    style={{ width: `${stats.monthlyPercent}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="card trainee-detail-card">
              <div className="section-title">📝 הערות</div>
              <div className={selectedTrainee.notes ? "trainee-notes" : "trainee-unavailable-state"}>
                {selectedTrainee.notes || "אין הערות עדיין."}
              </div>
            </section>
          </div>
        </div>

        <div className="trainee-danger-zone">
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => handleDelete(selectedTrainee.id)}
            disabled={actionsLocked || busy}
          >
            מחק מתאמן
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trainees-page slide-in">
      <div className="trainees-page-header">
        <div>
          <h2>מתאמנים</h2>
          <p>{trainees.filter((trainee) => trainee.status === "פעיל").length} מתאמנים פעילים</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditingTraineeId(null);
            setForm(emptyTraineeForm());
            setShowForm(true);
            setFormError("");
          }}
          disabled={actionsLocked}
        >
          + הוסף מתאמן
        </button>
      </div>

      {showForm && (
        <div className="card trainees-form-card">
          <div className="section-title">{editingTraineeId ? "✏️ עריכת מתאמן" : "👤 הוספת מתאמן חדש"}</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">שם מלא *</label>
              <input value={form.fullName} onChange={(e) => handleField("fullName", e.target.value)} className="form-input" placeholder="שם מלא" />
            </div>
            <div className="form-group">
              <label className="form-label">טלפון *</label>
              <input value={form.phone} onChange={(e) => handleField("phone", e.target.value)} className="form-input" placeholder="05X-XXXXXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">תאריך לידה</label>
              <input type="date" value={form.birthDate} onChange={(e) => handleField("birthDate", e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">תאריך התחלה *</label>
              <input type="date" value={form.startDate} onChange={(e) => handleField("startDate", e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">סוג אימון</label>
              <select value={form.trainingType} onChange={(e) => handleField("trainingType", e.target.value)} className="form-select">
                {trainingTypeOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סטטוס</label>
              <select value={form.status} onChange={(e) => handleField("status", e.target.value)} className="form-select">
                {statusOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">יעד מרכזי *</label>
            <input value={form.mainGoal} onChange={(e) => handleField("mainGoal", e.target.value)} className="form-input" placeholder="יעד מרכזי" />
          </div>
          <div className="form-group">
            <label className="form-label">מדד הצלחה</label>
            <input value={form.successMetric} onChange={(e) => handleField("successMetric", e.target.value)} className="form-input" placeholder="מדד הצלחה" />
          </div>
          <div className="form-group">
            <label className="form-label">הערות</label>
            <textarea value={form.notes} onChange={(e) => handleField("notes", e.target.value)} className="form-textarea" placeholder="הערות נוספות" />
          </div>
          <div className="section-title">💳 חבילה ותשלום</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">שם החבילה</label>
              <input value={form.packageName} onChange={(e) => handleField("packageName", e.target.value)} className="form-input" placeholder="למשל: 10 אימונים אישיים" />
            </div>
            <div className="form-group">
              <label className="form-label">מחיר החבילה</label>
              <input type="number" min="0" step="0.01" value={form.packagePrice} onChange={(e) => handleField("packagePrice", e.target.value)} className="form-input" placeholder="₪" />
            </div>
            <div className="form-group">
              <label className="form-label">שיטת תשלום</label>
              <select value={form.paymentMethod} onChange={(e) => handleField("paymentMethod", e.target.value)} className="form-select">
                <option value="">לא הוגדר</option>
                {paymentMethodOptions.map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סטטוס תשלום</label>
              <select value={form.paymentStatus} onChange={(e) => handleField("paymentStatus", e.target.value)} className="form-select">
                <option value="">לא הוגדר</option>
                {paymentStatusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">תשלום הבא</label>
              <input type="date" value={form.nextPaymentDate} onChange={(e) => handleField("nextPaymentDate", e.target.value)} className="form-input" />
            </div>
          </div>
          {formError && <div className="alert-strip danger">{formError}</div>}
          <div className="flex-gap">
            <button onClick={handleSave} disabled={actionsLocked} className="btn btn-primary btn-sm">{saving ? "שומר..." : editingTraineeId ? "שמור שינויים" : "שמור מתאמן"}</button>
            <button onClick={() => { setShowForm(false); setFormError(""); setEditingTraineeId(null); setForm(emptyTraineeForm()); }} disabled={saving} className="btn btn-outline btn-sm">ביטול</button>
          </div>
        </div>
      )}

      <div className="filter-chips trainees-filters">
        {["הכל", "אונליין", "אישי"].map((option) => (
          <button
            type="button"
            key={option}
            className={`filter-chip${filter === option ? " active" : ""}`}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {rowError && <div className="alert-strip danger">{rowError}</div>}

      {filteredTrainees.length === 0 ? (
        <div className="card empty-state">אין מתאמנים להצגה עדיין</div>
      ) : (
        <div className="trainee-cards-grid">
          {filteredTrainees.map((trainee) => {
            const stats = sessionStats(trainee.id);
            const activeProgram = activeProgramsByTrainee[trainee.id];
            const busy = rowActionId === trainee.id;

            return (
              <article
                key={trainee.id}
                className="trainee-card"
                role="button"
                tabIndex={0}
                aria-label={`פתיחת הפרופיל של ${trainee.full_name}`}
                onClick={() => setSelectedTraineeId(trainee.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedTraineeId(trainee.id);
                  }
                }}
                style={{ opacity: busy ? 0.65 : 1 }}
              >
                <div className="trainee-card-head">
                  <div className="trainee-card-person">
                    <div className="avatar avatar-lg">{initials(trainee.full_name)}</div>
                    <div>
                      <div className="trainee-card-name">{trainee.full_name}</div>
                      <div className="trainee-card-contact">
                        {trainee.phone || "לא הוזן טלפון"}
                      </div>
                    </div>
                  </div>
                  {trainee.phone && (
                    <a
                      href={whatsappLink(trainee.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-whatsapp btn-sm trainee-card-wa"
                      onClick={(event) => event.stopPropagation()}
                    >
                      WA
                    </a>
                  )}
                </div>

                <div className="trainee-card-badges">
                  <span className="badge badge-new">{trainee.training_type}</span>
                  <span className={`badge ${statusClass(trainee.status)}`}>
                    {trainee.status}
                  </span>
                  {activeProgram && <span className="badge badge-burg">תוכנית פעילה</span>}
                </div>

                <div className="trainee-card-program">
                  <div>
                    <span className="muted text-xs">תוכנית אימון</span>
                    <div>{activeProgram ? activeProgram.name : "אין תוכנית פעילה"}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenPrograms(trainee.id);
                    }}
                  >
                    {activeProgram ? "פתח" : "צור"}
                  </button>
                </div>

                <div className="trainee-card-progress">
                  <div className="flex-between">
                    <span className="muted text-sm">השלמה שבועית</span>
                    <strong>
                      {stats.weeklyCompleted}/{stats.weeklyPlanned}
                    </strong>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${stats.weeklyPercent >= 75 ? "green" : stats.weeklyPercent >= 40 ? "warn" : "danger"}`}
                      style={{ width: `${stats.weeklyPercent}%` }}
                    />
                  </div>
                </div>

                <div className="trainee-card-footer">
                  <span>{trainee.main_goal || "לא הוגדר יעד"}</span>
                  <span>לפרופיל ←</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}


function TraineeProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setLoadError("");

      try {
        const data = await fetchTraineeProfile();
        if (active) setProfile(data);
      } catch (error) {
        console.warn("Trainee profile fetch failed:", error?.name);
        if (active) setLoadError("לא ניתן לטעון את הפרופיל כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function formatProfileDate(value) {
    if (!value) return "לא הוזן";
    return new Date(`${value}T12:00:00`).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function profileAge(value) {
    if (!value) return null;
    const birthDate = new Date(`${value}T12:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }

  function profileInitials(fullName) {
    return (fullName || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "RK";
  }

  if (loading) {
    return <div className="trainee-home-state">טוען את הפרופיל...</div>;
  }

  if (loadError) {
    return (
      <div className="trainee-home-state">
        <p>{loadError}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="trainee-home-state">
        <strong>החשבון עדיין לא שויך למתאמן</strong>
        <p>יש לפנות למאמנת כדי להשלים את החיבור לחשבון.</p>
      </div>
    );
  }

  const age = profileAge(profile.birth_date);

  return (
    <div className="trainee-profile trainee-self-profile slide-in">
      <section className="trainee-profile-hero">
        <div className="trainee-profile-identity">
          <div className="avatar avatar-lg">{profileInitials(profile.full_name)}</div>
          <div>
            <span className="trainee-self-profile-label">הפרופיל שלי</span>
            <h2>{profile.full_name}</h2>
            <div className="trainee-card-badges">
              <span className="badge badge-new">{profile.training_type || "סוג אימון לא הוגדר"}</span>
            </div>
          </div>
        </div>
        <p className="trainee-self-profile-sync">הפרטים מעודכנים לפי הנתונים אצל רוני</p>
      </section>

      <div className="trainee-profile-grid">
        <section className="card trainee-detail-card">
          <div className="section-title">👤 פרטים אישיים</div>
          <div className="trainee-detail-list">
            <div><span className="trainee-detail-icon">📞</span><span><small>טלפון</small><strong>{profile.phone || "לא הוזן"}</strong></span></div>
            <div><span className="trainee-detail-icon">🎂</span><span><small>גיל</small><strong>{age ?? "לא הוזן"}</strong></span></div>
            <div><span className="trainee-detail-icon">📅</span><span><small>תאריך לידה</small><strong>{formatProfileDate(profile.birth_date)}</strong></span></div>
            <div><span className="trainee-detail-icon">🏁</span><span><small>תחילת אימון</small><strong>{formatProfileDate(profile.start_date)}</strong></span></div>
          </div>
        </section>

        <section className="card trainee-detail-card">
          <div className="section-title">🏋️ פרטי האימון</div>
          <div className="trainee-detail-list">
            <div><span className="trainee-detail-icon">🏋️</span><span><small>סוג אימון</small><strong>{profile.training_type || "לא הוזן"}</strong></span></div>
            <div><span className="trainee-detail-icon">🎯</span><span><small>יעד מרכזי</small><strong>{profile.main_goal || "לא הוזן"}</strong></span></div>
            <div><span className="trainee-detail-icon">📈</span><span><small>מדד הצלחה</small><strong>{profile.success_metric || "לא הוזן"}</strong></span></div>
          </div>
        </section>
      </div>
    </div>
  );
}


function TraineeHome() {
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      setLoading(true);
      setLoadError("");

      try {
        const data = await fetchTraineeHomeData();
        if (active) setHomeData(data);
      } catch (error) {
        console.warn("Trainee home fetch failed:", error?.name);
        if (active) setLoadError("לא ניתן לטעון את אזור המתאמן כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHome();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function formatDate(value) {
    if (!value) return "לא הוגדר";
    return new Date(`${value}T12:00:00`).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
    });
  }

  function formatTime(value) {
    return value ? value.slice(0, 5) : "";
  }

  if (loading) {
    return <div className="trainee-home-state">טוען את אזור המתאמן...</div>;
  }

  if (loadError) {
    return (
      <div className="trainee-home-state">
        <p>{loadError}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (!homeData?.trainee) {
    return (
      <div className="trainee-home-state">
        <strong>החשבון עדיין לא שויך למתאמן</strong>
        <p>יש לפנות למאמנת כדי להשלים את החיבור לחשבון.</p>
      </div>
    );
  }

  const { trainee, sessions, program, days } = homeData;
  const completedSessions = sessions.filter((session) => session.status === "הושלם").length;
  const weeklyTarget = program?.sessions_per_week ?? sessions.length;
  const progressPercent = weeklyTarget > 0
    ? Math.min(100, Math.round((completedSessions / weeklyTarget) * 100))
    : 0;

  return (
    <div className="trainee-home">
      <section className="trainee-home-welcome">
        <div>
          <span>שלום {trainee.full_name} 👋</span>
          <h2>{program ? program.name : "אזור המתאמן שלך"}</h2>
          <p>{program?.goal || trainee.main_goal || "התוכנית והאימונים שלך במקום אחד"}</p>
        </div>
        <span className="badge badge-burg">{trainee.training_type || "מתאמן"}</span>
      </section>

      <div className="trainee-home-metrics">
        <article className="trainee-home-metric">
          <span>אימוני השבוע</span>
          <strong>{sessions.length}</strong>
          <small>{completedSessions} הושלמו</small>
        </article>
        <article className="trainee-home-metric">
          <span>יעד שבועי</span>
          <strong>{weeklyTarget || "—"}</strong>
          <small>{program ? "לפי התוכנית הפעילה" : "טרם הוגדר"}</small>
        </article>
        <article className="trainee-home-metric">
          <span>השלמה</span>
          <strong>{weeklyTarget ? `${progressPercent}%` : "—"}</strong>
          <div className="progress-bar">
            <div className="progress-fill green" style={{ width: `${progressPercent}%` }} />
          </div>
        </article>
      </div>

      <div className="trainee-home-layout">
        <section className="card trainee-home-panel">
          <div className="section-title">📝 התוכנית השבועית</div>
          {!program ? (
            <div className="trainee-home-empty">אין תוכנית פעילה כרגע</div>
          ) : days.length === 0 ? (
            <div className="trainee-home-empty">התוכנית פעילה, אך עדיין לא נוספו לה ימי אימון</div>
          ) : (
            <div className="trainee-program-days">
              {days.map((day) => (
                <article className="trainee-program-day" key={day.id}>
                  <div className="trainee-program-day-title">
                    <span>{day.day_order}</span>
                    <div>
                      <strong>{day.name}</strong>
                      <small>{day.exercises.length} תרגילים</small>
                    </div>
                  </div>
                  <div className="trainee-exercise-list">
                    {day.exercises.map((exercise) => (
                      <div className="trainee-exercise" key={exercise.id}>
                        <span>{exercise.name}</span>
                        <small>{exercise.sets} סטים × {exercise.reps}</small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="trainee-home-side">
          <section className="card trainee-home-panel">
            <div className="section-title">📅 אימוני השבוע</div>
            {sessions.length === 0 ? (
              <div className="trainee-home-empty">אין אימונים מתוכננים השבוע</div>
            ) : (
              <div className="trainee-session-list">
                {sessions.map((session) => (
                  <article className="trainee-session" key={session.id}>
                    <div>
                      <strong>{formatDate(session.session_date)} · {formatTime(session.start_time)}</strong>
                      <small>{session.training_type} · {session.duration_minutes} דקות</small>
                    </div>
                    <span className={`badge ${session.status === "הושלם" ? "badge-active" : "badge-new"}`}>
                      {session.status}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card trainee-home-panel">
            <div className="section-title">🎯 היעד שלי</div>
            <p className="trainee-home-goal">{program?.goal || trainee.main_goal || "עדיין לא הוגדר יעד"}</p>
            {trainee.success_metric && <small className="muted">מדד הצלחה: {trainee.success_metric}</small>}
            {program?.end_date && (
              <small className="muted trainee-home-end-date">סיום התוכנית: {formatDate(program.end_date)}</small>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}


function formatCompletedWorkoutDate(value) {
  if (!value) return "לא הוגדר";
  return new Date(value).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWorkoutDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return "—";
  const minutes = Math.max(0, Math.round((new Date(completedAt) - new Date(startedAt)) / 60000));
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} ש׳ ${remainingMinutes} דק׳` : `${hours} שעות`;
}

function CompletedWorkoutDetails({ workout }) {
  const completedSets = workout.exercises
    .flatMap((exercise) => exercise.sets)
    .filter((workoutSet) => workoutSet.is_completed).length;
  const totalSets = workout.exercises.flatMap((exercise) => exercise.sets).length;

  return (
    <div className="completed-workout-details">
      <div className="completed-workout-summary">
        <article><span>משך</span><strong>{formatWorkoutDuration(workout.started_at, workout.completed_at)}</strong></article>
        <article><span>תרגילים</span><strong>{workout.exercises.length}</strong></article>
        <article><span>סטים שתועדו</span><strong>{completedSets}/{totalSets}</strong></article>
      </div>

      <div className="completed-workout-exercises">
        {workout.exercises.map((exercise) => (
          <section className="completed-workout-exercise" key={exercise.id}>
            <header>
              <div className="trainee-workout-exercise-name">
                <span>{exercise.exercise_order}</span>
                <div>
                  <strong>{exercise.exercise_name}</strong>
                  <small>יעד: {exercise.prescribed_sets} סטים × {exercise.prescribed_reps} · {exercise.target_weight_kg == null ? "ללא משקל יעד" : `${exercise.target_weight_kg} ק״ג`}</small>
                </div>
              </div>
              <span className={`badge ${exercise.is_completed ? "badge-active" : "badge-warn"}`}>
                {exercise.is_completed ? "הושלם" : "חלקי"}
              </span>
            </header>

            <div className="completed-workout-sets">
              <div className="completed-workout-set labels" aria-hidden="true">
                <span>סט</span><span>משקל</span><span>חזרות</span><span>RIR</span><span>מצב</span>
              </div>
              {exercise.sets.map((workoutSet) => (
                <div className="completed-workout-set" key={workoutSet.id}>
                  <strong>{workoutSet.set_order}</strong>
                  <span>{workoutSet.weight_kg == null ? "—" : `${workoutSet.weight_kg} ק״ג`}</span>
                  <span>{workoutSet.completed_reps ?? "—"}</span>
                  <span>{workoutSet.rir ?? "—"}</span>
                  <span>{workoutSet.is_completed ? "✓" : "—"}</span>
                </div>
              ))}
            </div>

            {exercise.trainee_notes && (
              <p className="completed-workout-note">💬 {exercise.trainee_notes}</p>
            )}

            {exercise.video_url && (
              <div className="completed-workout-video">
                <span>📹 סרטון מהמתאמן</span>
                <video controls playsInline preload="metadata" src={exercise.video_url}>
                  הדפדפן לא תומך בצפייה בסרטון.
                </video>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function CompletedWorkoutsList({ workouts, traineeNamesById = {}, emptyText }) {
  const [openWorkoutId, setOpenWorkoutId] = useState("");

  if (workouts.length === 0) {
    return <div className="completed-workouts-empty">{emptyText}</div>;
  }

  return (
    <div className="completed-workouts-list">
      {workouts.map((workout) => {
        const isOpen = openWorkoutId === workout.id;
        const traineeName = traineeNamesById[workout.trainee_id];
        const hasVideo = workout.exercises.some((exercise) => exercise.video_path);
        return (
          <article className={`card completed-workout-card ${isOpen ? "open" : ""}`} key={workout.id}>
            <button
              type="button"
              className="completed-workout-card-toggle"
              aria-expanded={isOpen}
              onClick={() => setOpenWorkoutId(isOpen ? "" : workout.id)}
            >
              <div>
                <strong>{traineeName ? `${traineeName} · ` : ""}{workout.day_name}</strong>
                <small>{workout.program_name} · {formatCompletedWorkoutDate(workout.completed_at)}</small>
              </div>
              <div className="completed-workout-card-badges">
                {hasVideo && <span className="badge badge-burg">📹 סרטון</span>}
                <span className="badge badge-active">הושלם וננעל</span>
                <span aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span>
              </div>
            </button>
            {isOpen && <CompletedWorkoutDetails workout={workout} />}
          </article>
        );
      })}
    </div>
  );
}

function WorkoutHistory({ workouts }) {
  return (
    <section className="workout-history">
      <div className="workout-history-heading">
        <div>
          <h3>🕘 אימונים קודמים</h3>
          <p>האימונים שסיימת נשמרים לצפייה בלבד ואינם ניתנים לעריכה.</p>
        </div>
        <span className="badge badge-new">{workouts.length} אימונים</span>
      </div>
      <CompletedWorkoutsList workouts={workouts} emptyText="עדיין אין אימונים שהושלמו." />
    </section>
  );
}

function Workout() {
  const [programData, setProgramData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [startingDayId, setStartingDayId] = useState("");
  const [savingSetIds, setSavingSetIds] = useState({});
  const [savingExerciseIds, setSavingExerciseIds] = useState({});
  const [uploadingVideoIds, setUploadingVideoIds] = useState({});
  const [videoErrors, setVideoErrors] = useState({});
  const [finishing, setFinishing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProgram() {
      setLoading(true);
      setLoadError("");

      try {
        const data = await fetchTraineeProgramData();
        const [activeWorkout, completedWorkouts] = data.trainee
          ? await Promise.all([
              fetchOpenWorkout(data.trainee.id),
              fetchCompletedWorkouts({ traineeId: data.trainee.id, limit: 20 }),
            ])
          : [null, []];
        if (active) setProgramData({ ...data, activeWorkout, completedWorkouts });
      } catch (error) {
        console.warn("Trainee program fetch failed:", error?.name);
        if (active) setLoadError("לא ניתן לטעון את תוכנית האימון כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProgram();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function formatProgramDate(value) {
    if (!value) return "לא הוגדר";
    return new Date(`${value}T12:00:00`).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatRest(seconds) {
    if (seconds == null) return "לא הוגדר";
    if (seconds < 60) return `${seconds} שנ׳`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds ? `${minutes}:${String(remainingSeconds).padStart(2, "0")} דק׳` : `${minutes} דק׳`;
  }

  function formatWorkoutStart(value) {
    return new Date(value).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function updateSetState(exerciseId, setId, changes) {
    setProgramData((current) => ({
      ...current,
      activeWorkout: {
        ...current.activeWorkout,
        exercises: current.activeWorkout.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === setId ? { ...set, ...changes } : set
                ),
              }
            : exercise
        ),
      },
    }));
  }

  function updateExerciseState(exerciseId, changes) {
    setProgramData((current) => ({
      ...current,
      activeWorkout: {
        ...current.activeWorkout,
        exercises: current.activeWorkout.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, ...changes } : exercise
        ),
      },
    }));
  }

  async function handleStartWorkout(day) {
    setStartingDayId(day.id);
    setActionError("");
    setNotice("");

    try {
      await startWorkout(day.id);
      setNotice(`האימון “${day.name}” התחיל. הנתונים נשמרים אוטומטית.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.warn("Workout start failed:", error?.name);
      setActionError("לא ניתן להתחיל את האימון כרגע. נסה שוב.");
    } finally {
      setStartingDayId("");
    }
  }

  async function handleSetSave(exerciseId, workoutSet, field) {
    setSavingSetIds((current) => ({ ...current, [workoutSet.id]: true }));
    setActionError("");

    try {
      const savedSet = await updateWorkoutSet(workoutSet.id, {
        [field]: workoutSet[field],
        is_completed: true,
      });
      updateSetState(exerciseId, workoutSet.id, savedSet);
    } catch (error) {
      console.warn("Workout set save failed:", error?.name);
      setActionError("אחד הסטים לא נשמר. בדוק את הערך ונסה שוב.");
    } finally {
      setSavingSetIds((current) => ({ ...current, [workoutSet.id]: false }));
    }
  }

  async function handleSetCompletion(exerciseId, workoutSet) {
    setSavingSetIds((current) => ({ ...current, [workoutSet.id]: true }));
    setActionError("");

    try {
      const savedSet = await updateWorkoutSet(workoutSet.id, {
        is_completed: !workoutSet.is_completed,
      });
      updateSetState(exerciseId, workoutSet.id, savedSet);
    } catch (error) {
      console.warn("Workout set completion failed:", error?.name);
      setActionError("סימון הסט לא נשמר. נסה שוב.");
    } finally {
      setSavingSetIds((current) => ({ ...current, [workoutSet.id]: false }));
    }
  }

  async function handleVideoUpload(exercise, file) {
    if (!file) return;

    setUploadingVideoIds((current) => ({ ...current, [exercise.id]: true }));
    setVideoErrors((current) => ({ ...current, [exercise.id]: "" }));

    try {
      const savedVideo = await uploadExerciseVideo({
        traineeId: programData.trainee.id,
        workoutId: programData.activeWorkout.id,
        exerciseId: exercise.id,
        file,
        previousPath: exercise.video_path,
      });
      updateExerciseState(exercise.id, savedVideo);
    } catch (error) {
      console.warn("Workout video upload failed:", error?.name);
      const message = error?.message === "video-too-large"
        ? "הסרטון גדול מ־50MB. נסה לצלם קטע קצר יותר."
        : error?.message === "unsupported-video"
          ? "סוג הסרטון אינו נתמך. אפשר להעלות MP4, MOV, M4V או WebM."
          : "הסרטון לא עלה. החיבור יכול להישמר לאימון ולנסות שוב.";
      setVideoErrors((current) => ({ ...current, [exercise.id]: message }));
    } finally {
      setUploadingVideoIds((current) => ({ ...current, [exercise.id]: false }));
    }
  }

  async function handleExerciseSave(exercise, changes) {
    setSavingExerciseIds((current) => ({ ...current, [exercise.id]: true }));
    setActionError("");

    try {
      const savedExercise = await updateWorkoutExercise(exercise.id, changes);
      updateExerciseState(exercise.id, savedExercise);
    } catch (error) {
      console.warn("Workout exercise save failed:", error?.name);
      setActionError("השינוי בתרגיל לא נשמר. נסה שוב.");
    } finally {
      setSavingExerciseIds((current) => ({ ...current, [exercise.id]: false }));
    }
  }

  async function handleFinishWorkout() {
    const hasPendingSaves =
      Object.values(savingSetIds).some(Boolean)
      || Object.values(savingExerciseIds).some(Boolean)
      || Object.values(uploadingVideoIds).some(Boolean);

    if (hasPendingSaves) {
      setActionError("יש להמתין לסיום שמירת הנתונים והסרטונים לפני סיום האימון.");
      return;
    }

    const workout = programData.activeWorkout;
    const emptySets = workout.exercises
      .flatMap((exercise) => exercise.sets)
      .filter((set) => !set.is_completed)
      .length;

    if (emptySets > 0) {
      const shouldFinish = window.confirm(
        `נשארו ${emptySets} סטים שלא סומנו כהושלמו. לסיים את האימון בכל זאת?`
      );
      if (!shouldFinish) return;
    }

    setFinishing(true);
    setActionError("");

    try {
      await finishWorkout(workout.id);
      setNotice("האימון הסתיים ונשמר בהצלחה.");
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.warn("Workout finish failed:", error?.name);
      setActionError("לא ניתן לסיים את האימון כרגע. הנתונים שכבר הזנת נשמרו.");
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return <div className="trainee-home-state">טוען את תוכנית האימון...</div>;
  }

  if (loadError) {
    return (
      <div className="trainee-home-state">
        <p>{loadError}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (!programData?.trainee) {
    return (
      <div className="trainee-home-state">
        <strong>החשבון עדיין לא שויך למתאמן</strong>
        <p>יש לפנות לרוני כדי להשלים את החיבור לחשבון.</p>
      </div>
    );
  }

  const { program, days, activeWorkout, completedWorkouts = [] } = programData;

  if (activeWorkout) {
    const allSets = activeWorkout.exercises.flatMap((exercise) => exercise.sets);
    const recordedSets = allSets.filter((set) => set.is_completed).length;
    const completedExercises = activeWorkout.exercises.filter(
      (exercise) => exercise.is_completed
    ).length;
    const hasPendingSaves =
      Object.values(savingSetIds).some(Boolean)
      || Object.values(savingExerciseIds).some(Boolean)
      || Object.values(uploadingVideoIds).some(Boolean);

    return (
      <div className="trainee-workout trainee-workout-live slide-in">
        <section className="trainee-workout-live-hero">
          <div>
            <span>אימון בביצוע · נשמר אוטומטית</span>
            <h2>{activeWorkout.day_name}</h2>
            <p>{activeWorkout.program_name}</p>
          </div>
          <small>התחלה: {formatWorkoutStart(activeWorkout.started_at)}</small>
        </section>

        {notice && <div className="trainee-workout-feedback success">{notice}</div>}
        {actionError && <div className="trainee-workout-feedback error">{actionError}</div>}

        <div className="trainee-workout-live-metrics">
          <article><span>תרגילים</span><strong>{completedExercises}/{activeWorkout.exercises.length}</strong></article>
          <article><span>סטים שתועדו</span><strong>{recordedSets}/{allSets.length}</strong></article>
          <article><span>התקדמות</span><strong>{allSets.length ? Math.round((recordedSets / allSets.length) * 100) : 0}%</strong></article>
        </div>

        <div className="trainee-workout-live-exercises">
          {activeWorkout.exercises.map((exercise) => (
            <section className={`card trainee-live-exercise ${exercise.is_completed ? "completed" : ""}`} key={exercise.id}>
              <header className="trainee-live-exercise-header">
                <div className="trainee-workout-exercise-name">
                  <span>{exercise.exercise_order}</span>
                  <div>
                    <strong>{exercise.exercise_name}</strong>
                    <p>{exercise.prescribed_sets} סטים · מנוחה {formatRest(exercise.rest_seconds)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`trainee-exercise-check ${exercise.is_completed ? "checked" : ""}`}
                  disabled={savingExerciseIds[exercise.id]}
                  onClick={() => handleExerciseSave(exercise, { is_completed: !exercise.is_completed })}
                >
                  {exercise.is_completed ? "✓ הושלם" : "סימון כהושלם"}
                </button>
              </header>

              {exercise.trainer_notes && (
                <p className="trainee-live-trainer-note">💬 {exercise.trainer_notes}</p>
              )}

              <div className="trainee-live-targets">
                <article>
                  <span>יעד משקל</span>
                  <strong>{exercise.target_weight_kg == null ? "—" : `${exercise.target_weight_kg} ק״ג`}</strong>
                </article>
                <article>
                  <span>יעד חזרות</span>
                  <strong>{exercise.prescribed_reps}</strong>
                </article>
                <article>
                  <span>יעד RIR</span>
                  <strong>{exercise.target_rir ?? "—"}</strong>
                </article>
              </div>

              <div className="trainee-live-sets">
                <div className="trainee-live-set trainee-live-set-labels" aria-hidden="true">
                  <span>סט</span><span>משקל (ק״ג)</span><span>חזרות</span><span>RIR</span><span>בוצע</span>
                </div>
                {exercise.sets.map((workoutSet) => {
                  const rirValue = workoutSet.rir === "" || workoutSet.rir == null
                    ? null
                    : Number(workoutSet.rir);
                  return (
                    <div className={`trainee-live-set ${workoutSet.is_completed ? "completed" : ""}`} key={workoutSet.id}>
                      <strong>{workoutSet.set_order}</strong>
                      <label>
                        <span>משקל</span>
                        <input aria-label={`משקל בסט ${workoutSet.set_order}`} type="number" min="0" max="2000" step="0.25" inputMode="decimal" value={workoutSet.weight_kg ?? ""} disabled={savingSetIds[workoutSet.id]} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSetState(exercise.id, workoutSet.id, { weight_kg: event.target.value, is_completed: false })} onBlur={() => handleSetSave(exercise.id, workoutSet, "weight_kg")} />
                        <small>קודם: {workoutSet.previous_weight_kg == null ? "—" : `${workoutSet.previous_weight_kg}`}</small>
                      </label>
                      <label>
                        <span>חזרות</span>
                        <input aria-label={`חזרות בסט ${workoutSet.set_order}`} type="number" min="0" max="1000" step="1" inputMode="numeric" value={workoutSet.completed_reps ?? ""} disabled={savingSetIds[workoutSet.id]} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSetState(exercise.id, workoutSet.id, { completed_reps: event.target.value, is_completed: false })} onBlur={() => handleSetSave(exercise.id, workoutSet, "completed_reps")} />
                        <small>קודם: {workoutSet.previous_reps ?? "—"}</small>
                      </label>
                      <label>
                        <span>RIR</span>
                        <input aria-label={`RIR בסט ${workoutSet.set_order}`} type="number" min="0" max="10" step="0.5" inputMode="decimal" value={workoutSet.rir ?? ""} disabled={savingSetIds[workoutSet.id]} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSetState(exercise.id, workoutSet.id, { rir: event.target.value, is_completed: false })} onBlur={() => handleSetSave(exercise.id, workoutSet, "rir")} />
                        <small>קודם: {workoutSet.previous_rir ?? "—"} · RPE {rirValue == null ? "—" : Math.max(0, 10 - rirValue)}</small>
                      </label>
                      <button
                        type="button"
                        className={`trainee-live-set-check ${workoutSet.is_completed ? "checked" : ""}`}
                        aria-label={workoutSet.is_completed ? `בטל השלמת סט ${workoutSet.set_order}` : `סמן סט ${workoutSet.set_order} כהושלם`}
                        disabled={savingSetIds[workoutSet.id]}
                        onClick={() => handleSetCompletion(exercise.id, workoutSet)}
                      >
                        {savingSetIds[workoutSet.id] ? "…" : workoutSet.is_completed ? "✓" : "○"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="trainee-live-video">
                {exercise.video_url ? (
                  <video controls playsInline preload="metadata" src={exercise.video_url}>
                    הדפדפן לא תומך בצפייה בסרטון.
                  </video>
                ) : (
                  <div className="trainee-live-video-empty">
                    <span>📹</span>
                    <div><strong>צלם את התרגיל</strong><small>סרטון קצר יעזור לרוני לתת משוב מדויק</small></div>
                  </div>
                )}
                <label className={`trainee-live-video-button ${uploadingVideoIds[exercise.id] ? "disabled" : ""}`}>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                    capture="environment"
                    disabled={uploadingVideoIds[exercise.id]}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleVideoUpload(exercise, file);
                      event.target.value = "";
                    }}
                  />
                  {uploadingVideoIds[exercise.id]
                    ? "מעלה סרטון..."
                    : exercise.video_path
                      ? "📹 החלף סרטון"
                      : "📹 צלם או העלה סרטון"}
                </label>
                <small className="trainee-live-video-hint">MP4, MOV, M4V או WebM · עד 50MB · הסרטון פרטי</small>
                {videoErrors[exercise.id] && (
                  <p className="trainee-live-video-error">{videoErrors[exercise.id]}</p>
                )}
              </div>

              <label className="trainee-live-exercise-note">
                <span>הערה לתרגיל</span>
                <textarea
                  rows="2"
                  placeholder="לדוגמה: הרגיש קל יותר מהשבוע שעבר"
                  value={exercise.trainee_notes ?? ""}
                  disabled={savingExerciseIds[exercise.id]}
                  onChange={(event) => updateExerciseState(exercise.id, { trainee_notes: event.target.value })}
                  onBlur={() => handleExerciseSave(exercise, { trainee_notes: exercise.trainee_notes ?? "" })}
                />
                <small>{savingExerciseIds[exercise.id] ? "שומר..." : "נשמר ביציאה מהשדה"}</small>
              </label>
            </section>
          ))}
        </div>

        <WorkoutHistory workouts={completedWorkouts} />

        <div className="trainee-workout-finish-bar">
          <div>
            <strong>{hasPendingSaves ? "שומר את הנתונים..." : "סיימת את האימון?"}</strong>
            <span>{hasPendingSaves ? "יש להמתין לפני נעילת האימון." : "לאחר הסיום האימון יינעל לעריכה."}</span>
          </div>
          <button type="button" className="btn btn-primary" disabled={finishing || hasPendingSaves} onClick={handleFinishWorkout}>
            {finishing ? "מסיים..." : hasPendingSaves ? "שומר..." : "סיום אימון"}
          </button>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="trainee-workout slide-in">
        <section className="trainee-workout-hero">
          <span>תוכנית האימון שלי</span>
          <h2>התוכנית הבאה שלך בבנייה</h2>
          <p>כשרוני תפעיל עבורך תוכנית, היא תופיע כאן באופן אוטומטי.</p>
        </section>
        <div className="trainee-home-state trainee-workout-empty">
          <strong>אין תוכנית פעילה כרגע</strong>
          <p>אפשר לפנות לרוני לקבלת עדכון.</p>
        </div>
        <WorkoutHistory workouts={completedWorkouts} />
      </div>
    );
  }

  const exercises = days.flatMap((day) => day.exercises);
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);

  return (
    <div className="trainee-workout slide-in">
      <section className="trainee-workout-hero">
        <span>תוכנית האימון שלי</span>
        <h2>{program.name}</h2>
        <p>{program.goal || "התוכנית הפעילה שלך מרוני"}</p>
        <div className="trainee-workout-dates">
          <small>התחלה: {formatProgramDate(program.start_date)}</small>
          <small>סיום: {formatProgramDate(program.end_date)}</small>
        </div>
      </section>

      <div className="trainee-workout-metrics">
        <article><span>ימי אימון</span><strong>{days.length}</strong></article>
        <article><span>תרגילים</span><strong>{exercises.length}</strong></article>
        <article><span>סה״כ סטים</span><strong>{totalSets}</strong></article>
        <article><span>יעד שבועי</span><strong>{program.sessions_per_week ?? "—"}</strong></article>
      </div>

      {program.notes && (
        <section className="trainee-workout-note">
          <span>💬</span>
          <div><strong>הערה מרוני</strong><p>{program.notes}</p></div>
        </section>
      )}

      {notice && <div className="trainee-workout-feedback success">{notice}</div>}
      {actionError && <div className="trainee-workout-feedback error">{actionError}</div>}

      {days.length === 0 ? (
        <div className="trainee-home-state trainee-workout-empty">
          <strong>התוכנית עדיין ללא ימי אימון</strong>
          <p>רוני תוסיף אותם כאן לאחר השלמת התוכנית.</p>
        </div>
      ) : (
        <div className="trainee-workout-days">
          {days.map((day) => (
            <section className="card trainee-workout-day" key={day.id}>
              <header className="trainee-workout-day-header">
                <div className="trainee-workout-day-heading">
                  <span>{day.day_order}</span>
                  <div>
                    <h3>{day.name}</h3>
                    <p>{day.exercises.length} תרגילים</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm trainee-workout-start"
                  disabled={startingDayId === day.id || day.exercises.length === 0}
                  onClick={() => handleStartWorkout(day)}
                >
                  {startingDayId === day.id ? "מתחיל..." : "התחלת אימון"}
                </button>
              </header>

              {day.notes && <p className="trainee-workout-day-note">{day.notes}</p>}

              {day.exercises.length === 0 ? (
                <div className="trainee-workout-no-exercises">עדיין לא נוספו תרגילים ליום הזה.</div>
              ) : (
                <div className="trainee-workout-exercises">
                  {day.exercises.map((exercise) => (
                    <article className="trainee-workout-exercise" key={exercise.id}>
                      <div className="trainee-workout-exercise-name">
                        <span>{exercise.exercise_order}</span>
                        <div><strong>{exercise.name}</strong>{exercise.notes && <p>{exercise.notes}</p>}</div>
                      </div>
                      <dl className="trainee-workout-exercise-data">
                        <div><dt>סטים</dt><dd>{exercise.sets}</dd></div>
                        <div><dt>חזרות</dt><dd>{exercise.reps}</dd></div>
                        <div><dt>משקל יעד</dt><dd>{exercise.target_weight_kg == null ? "—" : `${exercise.target_weight_kg} ק״ג`}</dd></div>
                        <div><dt>RIR</dt><dd>{exercise.target_rir ?? "—"}</dd></div>
                        <div><dt>מנוחה</dt><dd>{formatRest(exercise.rest_seconds)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <WorkoutHistory workouts={completedWorkouts} />
    </div>
  );
}


function startOfProgressWeek(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function buildProgressWeeks(workouts) {
  const currentWeek = startOfProgressWeek(new Date());

  return Array.from({ length: 4 }, (_, index) => {
    const start = new Date(currentWeek);
    start.setDate(currentWeek.getDate() - ((3 - index) * 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const count = workouts.filter((workout) => {
      const completedAt = new Date(workout.completed_at);
      return completedAt >= start && completedAt < end;
    }).length;

    return {
      key: start.toISOString(),
      label: start.toLocaleDateString("he-IL", { day: "numeric", month: "short" }),
      count,
    };
  });
}

function Progress() {
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      setLoading(true);
      setLoadError("");

      try {
        const homeData = await fetchTraineeHomeData();
        const workouts = homeData.trainee
          ? await fetchCompletedWorkouts({ traineeId: homeData.trainee.id, limit: 100 })
          : [];
        if (active) setProgressData({ ...homeData, workouts });
      } catch (error) {
        console.warn("Trainee progress fetch failed:", error?.name);
        if (active) setLoadError("לא ניתן לטעון את ההתקדמות כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProgress();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (loading) {
    return <div className="trainee-home-state">טוען את ההתקדמות שלך...</div>;
  }

  if (loadError) {
    return (
      <div className="trainee-home-state">
        <p>{loadError}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (!progressData?.trainee) {
    return (
      <div className="trainee-home-state">
        <strong>החשבון עדיין לא שויך למתאמן</strong>
        <p>יש לפנות לרוני כדי להשלים את החיבור לחשבון.</p>
      </div>
    );
  }

  const { trainee, program, workouts } = progressData;
  const weeks = buildProgressWeeks(workouts);
  const maxWeeklyWorkouts = Math.max(1, ...weeks.map((week) => week.count));
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 30);
  const recentMonthWorkouts = workouts.filter((workout) => new Date(workout.completed_at) >= monthStart).length;
  const allSets = workouts.flatMap((workout) =>
    workout.exercises.flatMap((exercise) => exercise.sets)
  );
  const completedSets = allSets.filter((workoutSet) => workoutSet.is_completed).length;
  const recordedSetPercent = allSets.length > 0
    ? Math.round((completedSets / allSets.length) * 100)
    : 0;
  const milestones = [
    { target: 1, icon: "🌱", label: "האימון הראשון" },
    { target: 5, icon: "⭐", label: "5 אימונים" },
    { target: 10, icon: "🏅", label: "10 אימונים" },
    { target: 25, icon: "🏆", label: "25 אימונים" },
  ];
  const achievedMilestones = milestones.filter((milestone) => workouts.length >= milestone.target).length;

  return (
    <div className="trainee-progress-page slide-in">
      <section className="trainee-progress-hero">
        <div>
          <span>ההתקדמות שלי</span>
          <h2>{program?.name || "הדרך שלך באימונים"}</h2>
          <p>{program?.goal || trainee.main_goal || "כל אימון שהושלם מתווסף לסיכום שלך"}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
          רענון
        </button>
      </section>

      <div className="trainee-progress-metrics">
        <article>
          <span>אימונים אחרונים</span>
          <strong>{workouts.length}</strong>
          <small>עד 100 אימונים שהושלמו</small>
        </article>
        <article>
          <span>30 הימים האחרונים</span>
          <strong>{recentMonthWorkouts}</strong>
          <small>אימונים שהסתיימו</small>
        </article>
        <article>
          <span>סטים שתועדו</span>
          <strong>{completedSets}</strong>
          <small>{allSets.length ? `${recordedSetPercent}% מהסטים באימונים` : "יתעדכן לאחר אימון"}</small>
        </article>
        <article>
          <span>הישגים</span>
          <strong>{achievedMilestones}/{milestones.length}</strong>
          <small>אבני דרך שהושלמו</small>
        </article>
      </div>

      <div className="trainee-progress-layout">
        <section className="card trainee-progress-panel">
          <div className="trainee-progress-panel-heading">
            <div>
              <h3>📊 עקביות בארבעת השבועות האחרונים</h3>
              <p>מספר האימונים שהשלמת בכל שבוע</p>
            </div>
            {program?.sessions_per_week && (
              <span className="badge badge-burg">יעד: {program.sessions_per_week} בשבוע</span>
            )}
          </div>
          <div className="trainee-progress-weeks">
            {weeks.map((week) => (
              <article key={week.key}>
                <strong>{week.count}</strong>
                <div className="trainee-progress-week-track" aria-hidden="true">
                  <span style={{ height: `${Math.max(week.count ? 16 : 4, (week.count / maxWeeklyWorkouts) * 100)}%` }} />
                </div>
                <small>{week.label}</small>
              </article>
            ))}
          </div>
          {workouts.length === 0 && (
            <p className="trainee-progress-empty">לאחר סיום האימון הראשון תופיע כאן תמונת העקביות שלך.</p>
          )}
        </section>

        <section className="card trainee-progress-panel">
          <div className="trainee-progress-panel-heading">
            <div>
              <h3>🎯 אבני הדרך שלי</h3>
              <p>הישגים שנפתחים לפי אימונים שהושלמו</p>
            </div>
          </div>
          <div className="trainee-progress-milestones">
            {milestones.map((milestone) => {
              const achieved = workouts.length >= milestone.target;
              return (
                <article className={achieved ? "achieved" : ""} key={milestone.target}>
                  <span>{milestone.icon}</span>
                  <div>
                    <strong>{milestone.label}</strong>
                    <small>{achieved ? "הושלם" : `${Math.min(workouts.length, milestone.target)}/${milestone.target}`}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className="trainee-progress-recent">
        <div className="workout-history-heading">
          <div>
            <h3>🕘 פעילות אחרונה</h3>
            <p>שלושת האימונים האחרונים שהשלמת</p>
          </div>
        </div>
        <CompletedWorkoutsList
          workouts={workouts.slice(0, 3)}
          emptyText="עדיין אין אימונים שהושלמו."
        />
      </section>
    </div>
  );
}


function Reviews() {
  const [workouts, setWorkouts] = useState([]);
  const [traineeNamesById, setTraineeNamesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      setLoading(true);
      setLoadError("");

      try {
        const [completedWorkouts, trainees] = await Promise.all([
          fetchCompletedWorkouts({ limit: 100 }),
          fetchTrainees(),
        ]);
        if (!active) return;
        setWorkouts(completedWorkouts);
        setTraineeNamesById(
          Object.fromEntries(trainees.map((trainee) => [trainee.id, trainee.full_name]))
        );
      } catch (error) {
        console.warn("Workout reviews fetch failed:", error?.name);
        if (active) setLoadError("לא ניתן לטעון את סקירות האימונים כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReviews();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const workoutsWithVideos = workouts.filter((workout) =>
    workout.exercises.some((exercise) => exercise.video_path)
  ).length;
  const workoutsWithNotes = workouts.filter((workout) =>
    workout.exercises.some((exercise) => exercise.trainee_notes)
  ).length;

  return (
    <div className="workout-reviews slide-in">
      <div className="workout-reviews-heading">
        <div>
          <h2>📋 סקירות אימונים</h2>
          <p>כל אימון שהסתיים, כולל הסטים, ההערות והסרטונים שהמתאמן שמר.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" disabled={loading} onClick={() => setReloadKey((key) => key + 1)}>
          {loading ? "טוען..." : "רענון"}
        </button>
      </div>

      <div className="workout-reviews-metrics">
        <article><span>אימונים שהושלמו</span><strong>{workouts.length}</strong></article>
        <article><span>אימונים עם סרטון</span><strong>{workoutsWithVideos}</strong></article>
        <article><span>אימונים עם הערות</span><strong>{workoutsWithNotes}</strong></article>
      </div>

      {loadError ? (
        <div className="trainee-home-state">
          <p>{loadError}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
            נסה שוב
          </button>
        </div>
      ) : loading ? (
        <div className="trainee-home-state">טוען אימונים שהושלמו...</div>
      ) : (
        <CompletedWorkoutsList
          workouts={workouts}
          traineeNamesById={traineeNamesById}
          emptyText="עדיין אין אימונים שהושלמו לסקירה."
        />
      )}
    </div>
  );
}



function Settings() {
  const [lang, setLang] = useState("he");
  const [checks, setChecks] = useState({ personal: false, online: false, group: false, reminders: false, leads: false, birthdays: false, renewals: false });
  const toggle = (k) => setChecks(p => ({ ...p, [k]: !p[k] }));
  const pill = (on) => ({ fontSize: 11, padding: "3px 10px", borderRadius: 10, cursor: "pointer", background: on ? "#7C2D3E" : "#EDEBE6", color: on ? "#fff" : "#9E9A90" });
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>הגדרות</h2>
        <div style={{ fontSize: 13, color: "#9E9A90", marginTop: 4 }}>פרטי עסק, העדפות ואינטגרציות</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>פרטי עסק</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>שם העסק</div>
          <div style={{ fontSize: 14, color: "#9E9A90", padding: "8px 12px", borderRadius: 8, border: "0.5px solid #EDEBE6", background: "#FAF8F5" }}>יתמלא לאחר חיבור נתונים</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>תיאור קצר</div>
          <div style={{ fontSize: 14, color: "#9E9A90", padding: "8px 12px", borderRadius: 8, border: "0.5px solid #EDEBE6", background: "#FAF8F5" }}>יתמלא לאחר חיבור נתונים</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>שפה</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div onClick={() => setLang("he")} style={{ fontSize: 13, padding: "6px 16px", borderRadius: 20, cursor: "pointer", background: lang === "he" ? "#F9F0F2" : "#fff", color: lang === "he" ? "#7C2D3E" : "#615E57", fontWeight: lang === "he" ? 600 : 400 }}>עברית</div>
          <div onClick={() => setLang("en")} style={{ fontSize: 13, padding: "6px 16px", borderRadius: 20, cursor: "pointer", background: lang === "en" ? "#F9F0F2" : "#fff", color: lang === "en" ? "#7C2D3E" : "#615E57", fontWeight: lang === "en" ? 600 : 400 }}>English</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>סוגי אימון</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>
          <div style={{ fontSize: 14 }}>אימון אישי</div>
          <div onClick={() => toggle("personal")} style={pill(checks.personal)}>{checks.personal ? "פעיל" : "כבוי"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>
          <div style={{ fontSize: 14 }}>אימון אונליין</div>
          <div onClick={() => toggle("online")} style={pill(checks.online)}>{checks.online ? "פעיל" : "כבוי"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
          <div style={{ fontSize: 14 }}>אימון קבוצתי</div>
          <div onClick={() => toggle("group")} style={pill(checks.group)}>{checks.group ? "פעיל" : "כבוי"}</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>התראות</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>
          <div style={{ fontSize: 14 }}>תזכורות אימון</div>
          <div onClick={() => toggle("reminders")} style={pill(checks.reminders)}>{checks.reminders ? "פעיל" : "כבוי"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>
          <div style={{ fontSize: 14 }}>מעקב לידים</div>
          <div onClick={() => toggle("leads")} style={pill(checks.leads)}>{checks.leads ? "פעיל" : "כבוי"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>
          <div style={{ fontSize: 14 }}>ימי הולדת</div>
          <div onClick={() => toggle("birthdays")} style={pill(checks.birthdays)}>{checks.birthdays ? "פעיל" : "כבוי"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
          <div style={{ fontSize: 14 }}>חידוש מנויים</div>
          <div onClick={() => toggle("renewals")} style={pill(checks.renewals)}>{checks.renewals ? "פעיל" : "כבוי"}</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>אינטגרציות עתידיות</div>
        <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 12 }}>חיבורים שיהיו זמינים בקרוב</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "0.5px solid #EDEBE6" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>📅 Google Calendar</div>
            <div style={{ fontSize: 12, color: "#9E9A90" }}>סנכרון אוטומטי של אימונים</div>
          </div>
          <div style={{ fontSize: 11, color: "#9E9A90", background: "#FAF8F5", padding: "3px 8px", borderRadius: 10, border: "0.5px solid #EDEBE6" }}>בקרוב</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>💬 WhatsApp</div>
            <div style={{ fontSize: 12, color: "#9E9A90" }}>שליחת תזכורות אוטומטיות</div>
          </div>
          <div style={{ fontSize: 11, color: "#9E9A90", background: "#FAF8F5", padding: "3px 8px", borderRadius: 10, border: "0.5px solid #EDEBE6" }}>בקרוב</div>
        </div>
      </div>
    </div>
  );
}


const VIEW_TITLES = {
  dashboard:      "לוח בקרה",
  leads:          "לידים",
  trainees:       "מתאמנים",
  "weekly-goals": "יעד שבועי למתאמנים",
  programs:       "תוכניות אימון",
  reviews:        "סקירות אימונים",
  schedule:       "לוח זמנים",
  revenue:        "כספים",
  settings:       "הגדרות",
  "trainee-home": "בית",
  "trainee-profile": "הפרופיל שלי",
  workout:        "תוכנית האימון שלי",
  progress:       "ההתקדמות שלי",
};

const ADMIN_GROUPS = [
  {
    label: "מרכז פיקוד",
    items: [
      { id: "dashboard", icon: "📊", label: "לוח בקרה" },
    ],
  },
  {
    label: "ניהול",
    items: [
      { id: "leads",    icon: "👥", label: "לידים" },
      { id: "trainees", icon: "💪", label: "מתאמנים" },
      { id: "weekly-goals", icon: "📈", label: "יעד שבועי למתאמנים" },
      { id: "reviews",  icon: "📋", label: "סקירות אימונים" },
      { id: "programs", icon: "📝", label: "תוכניות אימון" },
    ],
  },
  {
    label: 'פיננסי ולו"ז',
    items: [
      { id: "schedule", icon: "📅", label: "לוח זמנים" },
      { id: "revenue",  icon: "💰", label: "כספים" },
    ],
  },
  {
    label: "כללי",
    items: [
      { id: null,       icon: "🔔", label: "התראות", disabled: true },
      { id: "settings", icon: "⚙️",  label: "הגדרות" },
    ],
  },
];

const TRAINEE_GROUPS = [
  {
    label: "תפריט",
    items: [
      { id: "trainee-home", icon: "🏠", label: "בית" },
      { id: "trainee-profile", icon: "👤", label: "הפרופיל שלי" },
      { id: "workout",      icon: "🏋️",  label: "תוכנית האימון שלי" },
      { id: "progress",     icon: "📈", label: "ההתקדמות שלי" },
    ],
  },
];

function NavItem({ item, active, onClick }) {
  if (item.disabled) {
    return (
      <div className="slink" style={{ opacity: 0.38, cursor: "default", pointerEvents: "none" }}>
        <span style={{ fontSize: 15 }}>{item.icon}</span>
        <span>{item.label}</span>
        <span style={{ marginRight: "auto", fontSize: 10, color: "#9E9A90", background: "#F7F6F3", padding: "2px 7px", borderRadius: 8, border: "0.5px solid #EDEBE6" }}>בקרוב</span>
      </div>
    );
  }
  return (
    <div className={`slink${active ? " active" : ""}`} onClick={onClick}>
      <span style={{ fontSize: 15 }}>{item.icon}</span>
      <span>{item.label}</span>
    </div>
  );
}

export default function AppFullMigration({ onLogout, signingOut = false, signOutError = "", accountRole = "trainee" }) {
  const [view, setView] = useState(accountRole === "admin" ? "dashboard" : "trainee-home");
  const [role, setRole] = useState(accountRole);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProgramTraineeId, setSelectedProgramTraineeId] = useState("");

  function toggleRole() {
    if (accountRole !== "admin") return;
    const next = role === "admin" ? "trainee" : "admin";
    setRole(next);
    setView(next === "admin" ? "dashboard" : "trainee-home");
    setSidebarOpen(false);
  }

  function selectView(nextView) {
    if (nextView === "programs") {
      setSelectedProgramTraineeId("");
    }
    setView(nextView);
    setSidebarOpen(false);
  }

  function openProgramsForTrainee(traineeId) {
    setSelectedProgramTraineeId(traineeId);
    setView("programs");
    setSidebarOpen(false);
  }

  const groups = role === "admin" ? ADMIN_GROUPS : TRAINEE_GROUPS;

  return (
    <div className="app" dir="rtl">

      {/* Sidebar */}
      <div className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">R.K Fitness</div>
          <div className="sidebar-sub">RONI KALISKER</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
          {groups.map(group => (
            <div key={group.label}>
              <div className="sidebar-section">{group.label}</div>
              {group.items.map(item => (
                <NavItem
                  key={item.label}
                  item={item}
                  active={view === item.id}
                  onClick={item.disabled ? undefined : () => selectView(item.id)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          {accountRole === "admin" && (
            <button className="nav-role-btn" style={{ width: "100%" }} onClick={toggleRole}>
              {role === "admin" ? "מעבר לתצוגת מתאמן" : "מעבר לתצוגת מנהל"}
            </button>
          )}
        </div>
      </div>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="סגירת תפריט"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={sidebarOpen ? "סגירת תפריט" : "פתיחת תפריט"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
          <span className="topbar-title">{VIEW_TITLES[view] || view}</span>
          <div className="topbar-right">
            <button className="btn btn-ghost btn-sm">EN</button>
            <button className="btn btn-ghost btn-sm">🔔</button>
            {signOutError && (
              <span style={{ fontSize: 12, color: "#991B1B" }}>{signOutError}</span>
            )}
            {onLogout && (
              <button onClick={onLogout} disabled={signingOut} className="btn btn-outline btn-sm">
                {signingOut ? "מתנתק..." : "התנתקות"}
              </button>
            )}
          </div>
        </div>

        <div className="page">
          {view === "dashboard"    && <Dashboard onNavigate={selectView} />}
          {view === "leads"        && <Leads />}
          {view === "trainees"     && <Trainees onOpenPrograms={openProgramsForTrainee} />}
          {view === "weekly-goals" && <WeeklyGoals />}
          {view === "programs"     && <Programs initialTraineeId={selectedProgramTraineeId} />}
          {view === "reviews"      && <Reviews />}
          {view === "schedule"     && <Schedule />}
          {view === "revenue"      && <Finance />}
          {view === "settings"     && <Settings />}
          {view === "trainee-home" && <TraineeHome />}
          {view === "trainee-profile" && <TraineeProfile />}
          {view === "workout"      && <Workout />}
          {view === "progress"     && <Progress />}
        </div>
      </div>

    </div>
  );
}
