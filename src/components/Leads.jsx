import { useEffect, useRef, useState } from "react";
import {
  convertLeadToTrainee,
  createLead,
  deleteLead,
  fetchLeads,
  updateLead,
  updateLeadStatus,
} from "../services/leadsService.js";

const STATUSES = [
  "חדש",
  "נוצר קשר",
  "מעקב",
  "שיחת היכרות נקבעה",
  "הומר למתאמן",
  "לא רלוונטי",
];

const SOURCES = ["המלצה מחבר", "Instagram", "Facebook", "Google", "אחר"];
const HEALTH_STATUSES = ["לא נשלחה", "נשלחה", "הושלמה"];
const TRAINING_TYPES = ["אישי", "אונליין", "קבוצתי"];
const MANUAL_STATUSES = STATUSES.filter(
  (status) => status !== "הומר למתאמן"
);

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  email: "",
  gender: "",
  birthDate: "",
  source: "המלצה מחבר",
  customSource: "",
  referralName: "",
  status: "חדש",
  followUpDate: "",
  goal: "",
  experienceLevel: "",
  serviceType: "",
  location: "",
  availability: "",
  healthDeclarationStatus: "לא נשלחה",
  notes: "",
};

function whatsappLink(phone = "") {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function ageFromBirthDate(value) {
  if (!value) return null;
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}

function todayInputValue() {
  const now = new Date();
  const localTime = new Date(
    now.getTime() - now.getTimezoneOffset() * 60 * 1000
  );
  return localTime.toISOString().slice(0, 10);
}

function toForm(lead) {
  return {
    fullName: lead.full_name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    gender: lead.gender || "",
    birthDate: lead.birth_date || "",
    source: lead.source || "המלצה מחבר",
    customSource: lead.custom_source || "",
    referralName: lead.referral_name || "",
    status: lead.status || "חדש",
    followUpDate: lead.follow_up_date || "",
    goal: lead.goal || "",
    experienceLevel: lead.experience_level || "",
    serviceType: lead.service_type || "",
    location: lead.location || "",
    availability: lead.availability || "",
    healthDeclarationStatus:
      lead.health_declaration_status || "לא נשלחה",
    notes: lead.notes || "",
  };
}

function toPayload(form) {
  const optional = (value) => value.trim() || null;
  return {
    full_name: form.fullName.trim(),
    phone: form.phone.trim(),
    email: optional(form.email),
    gender: optional(form.gender),
    birth_date: form.birthDate || null,
    source: form.source,
    custom_source:
      form.source === "אחר" ? optional(form.customSource) : null,
    referral_name:
      form.source === "המלצה מחבר" ? optional(form.referralName) : null,
    status: form.status,
    follow_up_date: form.followUpDate || null,
    goal: optional(form.goal),
    experience_level: optional(form.experienceLevel),
    service_type: optional(form.serviceType),
    location: optional(form.location),
    availability: optional(form.availability),
    health_declaration_status: form.healthDeclarationStatus || null,
    notes: optional(form.notes),
  };
}

function Field({ label, children, wide = false }) {
  return (
    <div className={`lead-form-field${wide ? " lead-form-field-wide" : ""}`}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function Detail({ icon, label, value }) {
  return (
    <div className="lead-detail-row">
      <span className="lead-detail-icon" aria-hidden="true">{icon}</span>
      <div>
        <div className="lead-detail-label">{label}</div>
        <div className={`lead-detail-value${value ? "" : " muted"}`}>
          {value || "לא הוזן"}
        </div>
      </div>
    </div>
  );
}

function LeadForm({ initialLead, busy, error, onCancel, onSave }) {
  const [form, setForm] = useState(() =>
    initialLead ? toForm(initialLead) : { ...EMPTY_FORM }
  );

  function field(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <div className="modal-overlay" role="presentation">
      <form className="modal lead-form-modal slide-in" onSubmit={submit}>
        <div className="lead-modal-head">
          <div>
            <div className="modal-title">
              {initialLead ? "עריכת פרופיל ליד" : "הוספת ליד חדש"}
            </div>
            <div className="text-sm muted">כל הפרטים במקום אחד ✨</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy} aria-label="סגירה">✕</button>
        </div>

        <div className="lead-form-section">
          <div className="section-title">👤 פרטים אישיים</div>
          <div className="lead-form-grid">
            <Field label="שם מלא *">
              <input className="form-input" value={form.fullName} onChange={(event) => field("fullName", event.target.value)} />
            </Field>
            <Field label="טלפון *">
              <input className="form-input" dir="ltr" value={form.phone} onChange={(event) => field("phone", event.target.value)} />
            </Field>
            <Field label="אימייל">
              <input className="form-input" dir="ltr" type="email" value={form.email} onChange={(event) => field("email", event.target.value)} />
            </Field>
            <Field label="מגדר">
              <select className="form-select" value={form.gender} onChange={(event) => field("gender", event.target.value)}>
                <option value="">לא צוין</option>
                <option>אישה</option>
                <option>גבר</option>
                <option>אחר</option>
                <option>מעדיפ/ה לא לציין</option>
              </select>
            </Field>
            <Field label="תאריך לידה">
              <input className="form-input" type="date" value={form.birthDate} onChange={(event) => field("birthDate", event.target.value)} />
            </Field>
            <Field label="סטטוס">
              <select className="form-select" value={form.status} onChange={(event) => field("status", event.target.value)} disabled={Boolean(initialLead?.converted_trainee_id)}>
                {form.status === "הומר למתאמן" && (
                  <option>הומר למתאמן</option>
                )}
                {MANUAL_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="lead-form-section">
          <div className="section-title">🎯 התאמת אימון</div>
          <div className="lead-form-grid">
            <Field label="מטרה" wide>
              <textarea className="form-textarea" value={form.goal} onChange={(event) => field("goal", event.target.value)} />
            </Field>
            <Field label="רמת ניסיון">
              <select className="form-select" value={form.experienceLevel} onChange={(event) => field("experienceLevel", event.target.value)}>
                <option value="">לא צוין</option>
                <option>מתחיל/ה</option>
                <option>בינוני/ת</option>
                <option>מתקדם/ת</option>
              </select>
            </Field>
            <Field label="סוג שירות מבוקש">
              <select className="form-select" value={form.serviceType} onChange={(event) => field("serviceType", event.target.value)}>
                <option value="">לא צוין</option>
                <option>אימון אישי</option>
                <option>אימון אונליין</option>
                <option>אימון קבוצתי</option>
                <option>מסלול היברידי</option>
              </select>
            </Field>
            <Field label="מיקום">
              <input className="form-input" value={form.location} onChange={(event) => field("location", event.target.value)} />
            </Field>
            <Field label="זמינות">
              <input className="form-input" value={form.availability} onChange={(event) => field("availability", event.target.value)} placeholder="לדוגמה: א׳ ו־ג׳ בערב" />
            </Field>
          </div>
        </div>

        <div className="lead-form-section">
          <div className="section-title">📣 מקור ומעקב</div>
          <div className="lead-form-grid">
            <Field label="מקור הגעה">
              <select className="form-select" value={form.source} onChange={(event) => field("source", event.target.value)}>
                {SOURCES.map((source) => <option key={source}>{source}</option>)}
              </select>
            </Field>
            {form.source === "אחר" && (
              <Field label="מקור אחר">
                <input className="form-input" value={form.customSource} onChange={(event) => field("customSource", event.target.value)} />
              </Field>
            )}
            {form.source === "המלצה מחבר" && (
              <Field label="שם המפנה">
                <input className="form-input" value={form.referralName} onChange={(event) => field("referralName", event.target.value)} />
              </Field>
            )}
            <Field label="תאריך מעקב">
              <input className="form-input" type="date" value={form.followUpDate} onChange={(event) => field("followUpDate", event.target.value)} />
            </Field>
            <Field label="הצהרת בריאות">
              <select className="form-select" value={form.healthDeclarationStatus} onChange={(event) => field("healthDeclarationStatus", event.target.value)}>
                {HEALTH_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="הערות" wide>
              <textarea className="form-textarea" value={form.notes} onChange={(event) => field("notes", event.target.value)} />
            </Field>
          </div>
        </div>

        {error && <div className="alert-strip danger">{error}</div>}
        <div className="lead-form-actions">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "שומר..." : initialLead ? "שמור שינויים" : "שמור ליד"}
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>ביטול</button>
        </div>
      </form>
    </div>
  );
}

function ConversionModal({ lead, busy, error, onCancel, onConfirm }) {
  const [trainingType, setTrainingType] = useState("אישי");
  const [startDate, setStartDate] = useState(todayInputValue);

  return (
    <div className="modal-overlay">
      <form
        className="modal slide-in"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(trainingType, startDate);
        }}
      >
        <div className="modal-title">המרת {lead.full_name} למתאמן 💪</div>
        <p className="text-sm muted mb-20">
          המתאמן ייווצר פעם אחת בלבד ויישאר מקושר לליד.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">סוג אימון *</label>
            <select className="form-select" value={trainingType} onChange={(event) => setTrainingType(event.target.value)}>
              {TRAINING_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">תאריך התחלה *</label>
            <input className="form-input" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
        </div>
        {error && <div className="alert-strip danger">{error}</div>}
        <div className="lead-form-actions">
          <button className="btn btn-primary" disabled={busy || !startDate}>{busy ? "ממיר..." : "צור מתאמן"}</button>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>ביטול</button>
        </div>
      </form>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [filter, setFilter] = useState("הכול");
  const [formLead, setFormLead] = useState(undefined);
  const [showForm, setShowForm] = useState(false);
  const [conversionLead, setConversionLead] = useState(null);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;

  async function loadLeads() {
    setLoading(true);
    setLoadError("");
    try {
      setLeads(await fetchLeads());
    } catch {
      setLoadError("לא ניתן לטעון את הלידים כרגע.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchLeads()
      .then((data) => {
        if (active) setLeads(data);
      })
      .catch(() => {
        if (active) setLoadError("לא ניתן לטעון את הלידים כרגע.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function startCreate() {
    setFormLead(undefined);
    setActionError("");
    setShowForm(true);
  }

  function startEdit(lead) {
    setFormLead(lead);
    setActionError("");
    setShowForm(true);
  }

  async function saveLead(form) {
    if (actionLock.current) return;
    if (!form.fullName.trim() || !form.phone.trim()) {
      setActionError("שם מלא וטלפון הם שדות חובה.");
      return;
    }
    actionLock.current = true;
    setBusy(true);
    setActionError("");
    try {
      const saved = formLead
        ? await updateLead(formLead.id, toPayload(form))
        : await createLead(toPayload(form));
      setLeads((current) =>
        formLead
          ? current.map((lead) => (lead.id === saved.id ? saved : lead))
          : [saved, ...current]
      );
      if (formLead) setSelectedLeadId(saved.id);
      setShowForm(false);
      setFormLead(undefined);
    } catch {
      setActionError("לא ניתן לשמור את פרטי הליד. נסה שוב.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function changeStatus(lead, status) {
    if (actionLock.current || status === lead.status) return;
    actionLock.current = true;
    setBusy(true);
    setActionError("");
    try {
      const saved = await updateLeadStatus(lead.id, status);
      setLeads((current) =>
        current.map((item) => (item.id === saved.id ? saved : item))
      );
    } catch {
      setActionError("לא ניתן לעדכן את הסטטוס.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function removeLead(lead) {
    if (
      actionLock.current ||
      !window.confirm(`למחוק את הליד ${lead.full_name}?`)
    ) return;
    actionLock.current = true;
    setBusy(true);
    setActionError("");
    try {
      await deleteLead(lead.id);
      setLeads((current) => current.filter((item) => item.id !== lead.id));
      setSelectedLeadId(null);
    } catch {
      setActionError("לא ניתן למחוק את הליד.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function convert(trainingType, startDate) {
    if (!conversionLead || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setActionError("");
    try {
      const trainee = await convertLeadToTrainee(
        conversionLead.id,
        trainingType,
        startDate
      );
      setLeads((current) =>
        current.map((lead) =>
          lead.id === conversionLead.id
            ? {
                ...lead,
                status: "הומר למתאמן",
                converted_trainee_id: trainee.id,
              }
            : lead
        )
      );
      setConversionLead(null);
    } catch {
      setActionError("לא ניתן להמיר את הליד למתאמן. בדוק את הפרטים ונסה שוב.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="empty-state">טוען לידים...</div>;
  }

  if (loadError) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📥</div>
        <div className="mb-16">{loadError}</div>
        <button className="btn btn-primary" onClick={loadLeads}>נסה שוב</button>
      </div>
    );
  }

  if (selectedLead) {
    const age = ageFromBirthDate(selectedLead.birth_date);
    const source =
      selectedLead.source === "אחר" && selectedLead.custom_source
        ? selectedLead.custom_source
        : selectedLead.source;

    return (
      <div className="leads-page">
        <button className="btn btn-ghost lead-back-button" onClick={() => { setSelectedLeadId(null); setActionError(""); }}>→ חזרה לכל הלידים</button>
        <div className="lead-profile-hero">
          <div className="lead-profile-identity">
            <div className="avatar avatar-lg">{initials(selectedLead.full_name)}</div>
            <div>
              <div className="lead-profile-name">{selectedLead.full_name}</div>
              <div className="lead-profile-contact" dir="ltr">{selectedLead.phone}</div>
              <div className="lead-profile-badges">
                <span className="badge badge-burg">{selectedLead.status}</span>
                {source && <span className="badge badge-inactive">📣 {source}</span>}
              </div>
            </div>
          </div>
          <div className="lead-profile-actions">
            <a className="btn btn-whatsapp btn-sm" href={whatsappLink(selectedLead.phone)} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            <button className="btn btn-outline btn-sm" onClick={() => startEdit(selectedLead)} disabled={busy}>✏️ עריכה</button>
            <select className="form-select lead-status-select" value={selectedLead.status} onChange={(event) => changeStatus(selectedLead, event.target.value)} disabled={busy || Boolean(selectedLead.converted_trainee_id)}>
              {selectedLead.status === "הומר למתאמן" && (
                <option>הומר למתאמן</option>
              )}
              {MANUAL_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>

        {actionError && !showForm && !conversionLead && (
          <div className="alert-strip danger">{actionError}</div>
        )}

        <div className="lead-profile-grid">
          <div className="lead-profile-column">
            <section className="card lead-detail-card">
              <div className="section-title">👤 פרטים אישיים</div>
              <Detail icon="📞" label="טלפון" value={selectedLead.phone} />
              <Detail icon="✉️" label="אימייל" value={selectedLead.email} />
              <Detail icon="⚧" label="מגדר" value={selectedLead.gender} />
              <Detail icon="🎂" label="תאריך לידה" value={selectedLead.birth_date ? `${new Date(`${selectedLead.birth_date}T00:00:00`).toLocaleDateString("he-IL")}${age !== null ? ` · גיל ${age}` : ""}` : ""} />
            </section>
            <section className="card lead-detail-card">
              <div className="section-title">📣 מקור ומעקב</div>
              <Detail icon="📣" label="מקור הגעה" value={source} />
              <Detail icon="🧑‍🤝‍🧑" label="הפניה מ־" value={selectedLead.referral_name} />
              <Detail icon="📅" label="תאריך מעקב" value={selectedLead.follow_up_date ? new Date(`${selectedLead.follow_up_date}T00:00:00`).toLocaleDateString("he-IL") : ""} />
              <Detail icon="🩺" label="הצהרת בריאות" value={selectedLead.health_declaration_status} />
            </section>
          </div>

          <div className="lead-profile-column">
            <section className="card lead-detail-card">
              <div className="section-title">🎯 התאמת אימון</div>
              <Detail icon="🎯" label="מטרה" value={selectedLead.goal} />
              <Detail icon="📈" label="רמת ניסיון" value={selectedLead.experience_level} />
              <Detail icon="🏋️" label="סוג שירות" value={selectedLead.service_type} />
              <Detail icon="📍" label="מיקום" value={selectedLead.location} />
              <Detail icon="🕒" label="זמינות" value={selectedLead.availability} />
            </section>
            <section className="card lead-detail-card">
              <div className="section-title">📝 הערות</div>
              <div className={`lead-notes${selectedLead.notes ? "" : " muted"}`}>
                {selectedLead.notes || "אין הערות לליד זה."}
              </div>
            </section>
          </div>
        </div>

        <div className="card lead-conversion-card">
          <div>
            <div className="section-title mb-4">💪 מעבר למתאמן</div>
            <div className="text-sm muted">
              {selectedLead.converted_trainee_id
                ? "הליד כבר הומר ומקושר לפרופיל מתאמן."
                : "כשמחליטים להתחיל, יוצרים פרופיל מתאמן מהפרטים שכבר נאספו."}
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy || Boolean(selectedLead.converted_trainee_id)} onClick={() => { setActionError(""); setConversionLead(selectedLead); }}>
            {selectedLead.converted_trainee_id ? "הומר למתאמן ✓" : "המר למתאמן"}
          </button>
        </div>

        <button className="btn btn-danger btn-sm lead-delete-button" onClick={() => removeLead(selectedLead)} disabled={busy}>מחיקת ליד</button>

        {showForm && (
          <LeadForm initialLead={formLead} busy={busy} error={actionError} onCancel={() => { setShowForm(false); setActionError(""); }} onSave={saveLead} />
        )}
        {conversionLead && (
          <ConversionModal lead={conversionLead} busy={busy} error={actionError} onCancel={() => { setConversionLead(null); setActionError(""); }} onConfirm={convert} />
        )}
      </div>
    );
  }

  const visibleLeads =
    filter === "הכול" ? leads : leads.filter((lead) => lead.status === filter);

  return (
    <div className="leads-page">
      <div className="leads-page-header">
        <div>
          <h2>לידים</h2>
          <p>כל הפניות, המעקב וההמרות במקום אחד</p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>+ הוסף ליד</button>
      </div>

      <div className="filter-chips leads-filters" role="group" aria-label="סינון לפי סטטוס">
        {["הכול", ...STATUSES].map((status) => {
          const count =
            status === "הכול"
              ? leads.length
              : leads.filter((lead) => lead.status === status).length;
          return (
            <button key={status} className={`filter-chip${filter === status ? " active" : ""}`} onClick={() => setFilter(status)}>
              {status} <span>{count}</span>
            </button>
          );
        })}
      </div>

      {actionError && !showForm && (
        <div className="alert-strip danger">{actionError}</div>
      )}

      {visibleLeads.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">👥</div>
          <div>{leads.length === 0 ? "אין לידים עדיין. אפשר להוסיף את הראשון." : "אין לידים בסטטוס הזה."}</div>
        </div>
      ) : (
        <div className="lead-list card">
          {visibleLeads.map((lead) => {
            const source =
              lead.source === "אחר" && lead.custom_source
                ? lead.custom_source
                : lead.source;
            return (
              <button key={lead.id} className="lead-list-row" onClick={() => setSelectedLeadId(lead.id)}>
                <div className="lead-list-person">
                  <span className="avatar">{initials(lead.full_name)}</span>
                  <span>
                    <span className="lead-list-name">{lead.full_name}</span>
                    <span className="lead-list-contact" dir="ltr">{lead.phone}</span>
                  </span>
                </div>
                <span className="lead-list-meta">
                  <span>{source ? `📣 ${source}` : "מקור לא צוין"}</span>
                  <span>{lead.service_type ? `🏋️ ${lead.service_type}` : "שירות לא צוין"}</span>
                </span>
                <span className="lead-list-followup">
                  {lead.follow_up_date ? `📅 ${new Date(`${lead.follow_up_date}T00:00:00`).toLocaleDateString("he-IL")}` : "ללא מעקב"}
                </span>
                <span className="lead-list-end">
                  <span className="badge badge-burg">{lead.status}</span>
                  <span className="lead-list-arrow">←</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <LeadForm initialLead={formLead} busy={busy} error={actionError} onCancel={() => { setShowForm(false); setActionError(""); }} onSave={saveLead} />
      )}
    </div>
  );
}
