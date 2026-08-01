import { useEffect, useRef, useState } from "react";
import { fetchTrainees, createTrainee, updateTrainee, updateTraineeStatus, deleteTrainee } from "./services/traineesService.js";
import { fetchSessions } from "./services/sessionsService.js";
import { fetchActivePrograms } from "./services/programsService.js";
import Dashboard from "./components/Dashboard.jsx";
import Finance from "./components/Finance.jsx";
import Leads from "./components/Leads.jsx";
import Programs from "./components/Programs.jsx";
import Schedule from "./components/Schedule.jsx";

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


function TraineeHome() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>אזור מתאמן</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>תוכנית שבועית, התקדמות ומשימות</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>אימוני השבוע</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>יעד נוכחי</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>התקדמות</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>תוכנית שבועית</div>
        <div style={{ fontSize: 14, color: "#9E9A90", textAlign: "center", padding: "24px 0" }}>אין תוכנית עדיין</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>יעדים והתקדמות</div>
        <div style={{ fontSize: 14, color: "#9E9A90", textAlign: "center", padding: "24px 0" }}>אין נתונים עדיין</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>הודעה מהמאמן</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין הודעות</div>
      </div>
    </div>
  );
}


function Workout() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>אימון</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>תרגילים, סטים ומשוב</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>תרגילים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>סטים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>משוב</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>תוכנית אימון</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין תוכנית עדיין</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>רשימת תרגילים</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין תרגילים להצגה</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>משוב והערות</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין משוב עדיין</div>
      </div>
    </div>
  );
}


function Progress() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>התקדמות</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>יעדים, מדדים וסיכום התקדמות</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>יעד פעיל</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>מדדים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>הישגים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>יעדים</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין יעדים עדיין</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>מדדים</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין מדדים להצגה</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>סיכום התקדמות</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין נתונים עדיין</div>
      </div>
    </div>
  );
}


function Reviews() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>סקירות</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>מעקב אחרי אימונים, משובים ומשימות לבדיקה</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>ממתינים לסקירה</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>משובים חדשים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>דורשים פעולה</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>תור לסקירה</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין אימונים לסקירה</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>משובים ממתאמנים</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין משובים חדשים</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>משימות לפעולה</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין משימות פתוחות</div>
      </div>
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
  programs:       "תוכניות אימון",
  reviews:        "סקירות אימונים",
  schedule:       "לוח זמנים",
  revenue:        "כספים",
  settings:       "הגדרות",
  "trainee-home": "בית",
  workout:        "האימון שלי",
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
      { id: null,       icon: "📈", label: "התקדמות מתאמנים", disabled: true },
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
      { id: "workout",      icon: "🏋️",  label: "האימון שלי" },
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

export default function AppFullMigration({ onLogout, signingOut = false, signOutError = "" }) {
  const [view, setView] = useState("dashboard");
  const [role, setRole] = useState("admin");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProgramTraineeId, setSelectedProgramTraineeId] = useState("");

  function toggleRole() {
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
          <button className="nav-role-btn" style={{ width: "100%" }} onClick={toggleRole}>
            {role === "admin" ? "מעבר לתצוגת מתאמן" : "מעבר לתצוגת מנהל"}
          </button>
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
          {view === "programs"     && <Programs initialTraineeId={selectedProgramTraineeId} />}
          {view === "reviews"      && <Reviews />}
          {view === "schedule"     && <Schedule />}
          {view === "revenue"      && <Finance />}
          {view === "settings"     && <Settings />}
          {view === "trainee-home" && <TraineeHome />}
          {view === "workout"      && <Workout />}
          {view === "progress"     && <Progress />}
        </div>
      </div>

    </div>
  );
}
