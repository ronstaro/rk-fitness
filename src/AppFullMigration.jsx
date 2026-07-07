import { useEffect, useState } from "react";

function Screen({ title }) {
  return (
    <div>
      <h2 style={{ marginBottom: 8, color: "#1E1C19" }}>{title}</h2>
      <p style={{ color: "#9E9A90", marginTop: 8 }}>בפיתוח</p>
    </div>
  );
}


function Dashboard() {
  return (
    <div>
      <div style={{ background: "#7C2D3E", color: "#fff", borderRadius: 12, padding: 22, marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>שלום, רוני ✨</div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>ברוכה הבאה לדשבורד שלך</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>מתאמנים פעילים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>לידים חדשים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>הכנסה חודשית</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>סקירה מהירה</div>
        <div style={{ fontSize: 14, color: "#615E57", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>📋 אימונים שממתינים לסקירה</div>
        <div style={{ fontSize: 14, color: "#615E57", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>📥 לידים למעקב</div>
        <div style={{ fontSize: 14, color: "#615E57", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>💳 תשלומים / חידושים</div>
        <div style={{ fontSize: 14, color: "#615E57", padding: "8px 0" }}>📅 לו״ז להיום</div>
      </div>
    </div>
  );
}


function Leads() {
  const STORAGE_KEY = "rk-fitness-leads";

  function loadLeads() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const [leads, setLeads] = useState(loadLeads);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    source: "המלצה מחבר",
    customSource: "",
    status: "חדש",
    followUpDate: "",
    notes: "",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  function handleField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    const name = form.fullName.trim();
    const phone = form.phone.trim();
    if (!name || !phone) {
      setFormError("שם מלא וטלפון הם שדות חובה");
      return;
    }
    const lead = {
      id: Date.now().toString(),
      fullName: name,
      phone,
      source: form.source,
      customSource: form.source === "אחר" ? form.customSource.trim() : "",
      status: form.status,
      followUpDate: form.followUpDate,
      notes: form.notes.trim(),
      createdAt: new Date().toLocaleDateString("he-IL"),
    };
    setLeads((prev) => [lead, ...prev]);
    setForm({ fullName: "", phone: "", source: "המלצה מחבר", customSource: "", status: "חדש", followUpDate: "", notes: "" });
    setFormError("");
    setShowForm(false);
  }

  function handleStatusChange(id, newStatus) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: newStatus } : l));
  }

  function handleDelete(id) {
    if (window.confirm("למחוק ליד זה?")) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
    }
  }

  function waLink(phone) {
    return "https://wa.me/" + phone.replace(/\D/g, "");
  }

  const kpiNew = leads.filter((l) => l.status === "חדש").length;
  const kpiFollowUp = leads.filter((l) => l.status === "מעקב").length;
  const kpiConverted = leads.filter((l) => l.status === "הומר למתאמן").length;

  const reminders = leads
    .filter((l) => l.followUpDate && l.status !== "הומר למתאמן" && l.status !== "לא רלוונטי")
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

  const statusOptions = ["חדש", "נוצר קשר", "מעקב", "הומר למתאמן", "לא רלוונטי"];
  const sourceOptions = ["המלצה מחבר", "Instagram", "Facebook", "אחר"];

  const inp = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "0.5px solid #EDEBE6",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#FAF8F5",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>לידים</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>ניהול פניות ומעקב</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormError(""); }} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "#7C2D3E", color: "#fff", cursor: "pointer" }}>+ הוסף ליד</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>לידים חדשים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpiNew}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>למעקב</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpiFollowUp}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>הומרו למתאמנים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpiConverted}</div>
        </div>
      </div>
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>הוספת ליד חדש</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>שם מלא *</div>
              <input value={form.fullName} onChange={(e) => handleField("fullName", e.target.value)} style={inp} placeholder="שם מלא" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>טלפון *</div>
              <input value={form.phone} onChange={(e) => handleField("phone", e.target.value)} style={inp} placeholder="05X-XXXXXXX" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>מקור הגעה</div>
              <select value={form.source} onChange={(e) => handleField("source", e.target.value)} style={inp}>
                {sourceOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>סטטוס</div>
              <select value={form.status} onChange={(e) => handleField("status", e.target.value)} style={inp}>
                {statusOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          {form.source === "אחר" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>פרט מקור אחר</div>
              <input value={form.customSource} onChange={(e) => handleField("customSource", e.target.value)} style={inp} placeholder="מקור הגעה" />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>תאריך מעקב</div>
            <input type="date" value={form.followUpDate} onChange={(e) => handleField("followUpDate", e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>הערות</div>
            <textarea value={form.notes} onChange={(e) => handleField("notes", e.target.value)} style={{ ...inp, height: 72, resize: "vertical" }} placeholder="הערות נוספות" />
          </div>
          {formError && <div style={{ fontSize: 13, color: "#C0392B", marginBottom: 12 }}>{formError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 8, border: "none", background: "#7C2D3E", color: "#fff", cursor: "pointer" }}>שמור ליד</button>
            <button onClick={() => { setShowForm(false); setFormError(""); }} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "0.5px solid #EDEBE6", background: "#fff", color: "#615E57", cursor: "pointer" }}>ביטול</button>
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>רשימת לידים</div>
        {leads.length === 0 ? (
          <div style={{ fontSize: 14, color: "#9E9A90", textAlign: "center", padding: "24px 0" }}>כאן יוצגו לידים לאחר חיבור נתונים</div>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} style={{ padding: "12px 0", borderBottom: "0.5px solid #EDEBE6" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{lead.fullName}</div>
                  <div style={{ fontSize: 12, color: "#9E9A90" }}>{lead.phone} · {lead.source === "אחר" && lead.customSource ? lead.customSource : lead.source}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={lead.status} onChange={(e) => handleStatusChange(lead.id, e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #EDEBE6", background: "#FAF8F5", cursor: "pointer" }}>
                    {statusOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                  <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#25D366", textDecoration: "none" }}>WA</a>
                  <button onClick={() => handleDelete(lead.id)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "none", background: "#FAF8F5", color: "#C0392B", cursor: "pointer" }}>מחק</button>
                </div>
              </div>
              {lead.followUpDate && <div style={{ fontSize: 12, color: "#7C2D3E" }}>מעקב: {lead.followUpDate}</div>}
              {lead.notes && <div style={{ fontSize: 12, color: "#9E9A90", marginTop: 2 }}>{lead.notes}</div>}
              <div style={{ fontSize: 11, color: "#C4C0B8", marginTop: 4 }}>נוסף: {lead.createdAt}</div>
            </div>
          ))
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>תזכורות מעקב</div>
        {reminders.length === 0 ? (
          <div style={{ fontSize: 14, color: "#9E9A90" }}>אין תזכורות מעקב פעילות</div>
        ) : (
          reminders.map((lead) => (
            <div key={lead.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{lead.fullName}</div>
                <div style={{ fontSize: 12, color: "#9E9A90" }}>{lead.status}</div>
              </div>
              <div style={{ fontSize: 13, color: "#7C2D3E" }}>{lead.followUpDate}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


function Trainees() {
  const STORAGE_KEY = "rk-fitness-trainees";

  function loadTrainees() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const [trainees, setTrainees] = useState(loadTrainees);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("הכל");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    birthDate: "",
    startDate: "",
    trainingType: "אישי",
    status: "פעיל",
    mainGoal: "",
    successMetric: "",
    notes: "",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trainees));
  }, [trainees]);

  function handleField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const startDate = form.startDate.trim();
    const mainGoal = form.mainGoal.trim();
    if (!fullName || !phone || !startDate || !mainGoal) {
      setFormError("שם מלא, טלפון, תאריך התחלה ויעד מרכזי הם שדות חובה");
      return;
    }
    const trainee = {
      id: Date.now().toString(),
      fullName,
      phone,
      birthDate: form.birthDate,
      startDate,
      trainingType: form.trainingType,
      status: form.status,
      mainGoal,
      successMetric: form.successMetric.trim(),
      notes: form.notes.trim(),
      createdAt: new Date().toLocaleDateString("he-IL"),
    };
    setTrainees((prev) => [trainee, ...prev]);
    setForm({ fullName: "", phone: "", birthDate: "", startDate: "", trainingType: "אישי", status: "פעיל", mainGoal: "", successMetric: "", notes: "" });
    setFormError("");
    setShowForm(false);
  }

  function handleStatusChange(id, newStatus) {
    setTrainees((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t));
  }

  function handleDelete(id) {
    if (window.confirm("למחוק מתאמן זה?")) {
      setTrainees((prev) => prev.filter((t) => t.id !== id));
    }
  }

  function waLink(phone) {
    return "https://wa.me/" + phone.replace(/\D/g, "");
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

  const kpiActive = trainees.filter((t) => t.status === "פעיל").length;
  const kpiOnline = trainees.filter((t) => t.trainingType === "אונליין").length;
  const kpiPersonal = trainees.filter((t) => t.trainingType === "אישי").length;
  const kpiFollowUp = trainees.filter((t) => t.status === "דורש מעקב").length;

  const filteredTrainees = filter === "פעילים"
    ? trainees.filter((t) => t.status === "פעיל")
    : filter === "מעקב"
    ? trainees.filter((t) => t.status === "דורש מעקב")
    : trainees;

  const statusOptions = ["פעיל", "בהקפאה", "דורש מעקב", "הסתיים"];
  const trainingTypeOptions = ["אישי", "אונליין", "קבוצתי"];

  const inp = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "0.5px solid #EDEBE6",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#FAF8F5",
  };

  const pillStyle = (active) => ({
    fontSize: 13,
    padding: "6px 14px",
    borderRadius: 20,
    cursor: "pointer",
    background: active ? "#F9F0F2" : "#fff",
    color: active ? "#7C2D3E" : "#615E57",
    fontWeight: active ? 600 : 400,
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>מתאמנים</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>ניהול מתאמנים, סטטוס ותוכניות</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormError(""); }} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "#7C2D3E", color: "#fff", cursor: "pointer" }}>+ הוסף מתאמן</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>מתאמנים פעילים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpiActive}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>אונליין / פרונטלי</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{kpiOnline} אונליין / {kpiPersonal} אישי</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>דורשים מעקב</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpiFollowUp}</div>
        </div>
      </div>
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>הוספת מתאמן חדש</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>שם מלא *</div>
              <input value={form.fullName} onChange={(e) => handleField("fullName", e.target.value)} style={inp} placeholder="שם מלא" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>טלפון *</div>
              <input value={form.phone} onChange={(e) => handleField("phone", e.target.value)} style={inp} placeholder="05X-XXXXXXX" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>תאריך לידה</div>
              <input type="date" value={form.birthDate} onChange={(e) => handleField("birthDate", e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>תאריך התחלה *</div>
              <input type="date" value={form.startDate} onChange={(e) => handleField("startDate", e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>סוג אימון</div>
              <select value={form.trainingType} onChange={(e) => handleField("trainingType", e.target.value)} style={inp}>
                {trainingTypeOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>סטטוס</div>
              <select value={form.status} onChange={(e) => handleField("status", e.target.value)} style={inp}>
                {statusOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>יעד מרכזי *</div>
            <input value={form.mainGoal} onChange={(e) => handleField("mainGoal", e.target.value)} style={inp} placeholder="יעד מרכזי" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>מדד הצלחה</div>
            <input value={form.successMetric} onChange={(e) => handleField("successMetric", e.target.value)} style={inp} placeholder="מדד הצלחה" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>הערות</div>
            <textarea value={form.notes} onChange={(e) => handleField("notes", e.target.value)} style={{ ...inp, height: 72, resize: "vertical" }} placeholder="הערות נוספות" />
          </div>
          {formError && <div style={{ fontSize: 13, color: "#C0392B", marginBottom: 12 }}>{formError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 8, border: "none", background: "#7C2D3E", color: "#fff", cursor: "pointer" }}>שמור מתאמן</button>
            <button onClick={() => { setShowForm(false); setFormError(""); }} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "0.5px solid #EDEBE6", background: "#fff", color: "#615E57", cursor: "pointer" }}>ביטול</button>
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div onClick={() => setFilter("הכל")} style={pillStyle(filter === "הכל")}>הכל</div>
          <div onClick={() => setFilter("פעילים")} style={pillStyle(filter === "פעילים")}>פעילים</div>
          <div onClick={() => setFilter("מעקב")} style={pillStyle(filter === "מעקב")}>מעקב</div>
        </div>
        {filteredTrainees.length === 0 ? (
          <div style={{ fontSize: 14, color: "#9E9A90", textAlign: "center", padding: "24px 0" }}>אין מתאמנים להצגה עדיין</div>
        ) : (
          filteredTrainees.map((t) => {
            const years = trainingYears(t.startDate);
            return (
              <div key={t.id} style={{ padding: "12px 0", borderBottom: "0.5px solid #EDEBE6" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.fullName}</div>
                    <div style={{ fontSize: 12, color: "#9E9A90" }}>{t.phone} · {t.trainingType} · התחיל {t.startDate}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={t.status} onChange={(e) => handleStatusChange(t.id, e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #EDEBE6", background: "#FAF8F5", cursor: "pointer" }}>
                      {statusOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    <a href={waLink(t.phone)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#25D366", textDecoration: "none" }}>WA</a>
                    <button onClick={() => handleDelete(t.id)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "none", background: "#FAF8F5", color: "#C0392B", cursor: "pointer" }}>מחק</button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#615E57", marginBottom: 2 }}>יעד: {t.mainGoal}</div>
                {t.successMetric && <div style={{ fontSize: 12, color: "#9E9A90" }}>מדד: {t.successMetric}</div>}
                {t.notes && <div style={{ fontSize: 12, color: "#9E9A90", marginTop: 2 }}>{t.notes}</div>}
                {years >= 1 && (
                  <div style={{ fontSize: 12, color: "#7C2D3E", marginTop: 4 }}>
                    {years === 1 ? "השלימו שנת אימונים" : `השלימו ${years} שנות אימונים`}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#C4C0B8", marginTop: 4 }}>נוסף: {t.createdAt}</div>
              </div>
            );
          })
        )}
      </div>
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


function Schedule() {
  const SCHED_KEY = "rk-fitness-schedule";
  const TRAIN_KEY = "rk-fitness-trainees";

  function loadSessions() {
    try {
      const raw = localStorage.getItem(SCHED_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function loadTrainees() {
    try {
      const raw = localStorage.getItem(TRAIN_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  const [sessions, setSessions] = useState(loadSessions);
  const [trainees] = useState(loadTrainees);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    traineeId: "",
    traineeName: "",
    date: "",
    startTime: "",
    durationMinutes: "",
    trainingType: "אישי",
    location: "",
    status: "מתוכנן",
    notes: "",
  });

  useEffect(() => {
    localStorage.setItem(SCHED_KEY, JSON.stringify(sessions));
  }, [sessions]);

  function handleField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleTraineeSelect(traineeId) {
    const t = trainees.find((tr) => tr.id === traineeId);
    setForm((f) => ({ ...f, traineeId, traineeName: t ? t.fullName : "" }));
  }

  function toMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }

  function addMinutes(timeStr, mins) {
    const total = toMinutes(timeStr) + Number(mins);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function hasOverlap(newDate, newStart, newDur, existingSessions) {
    const newStartM = toMinutes(newStart);
    const newEndM = newStartM + Number(newDur);
    return existingSessions.some((s) => {
      if (s.date !== newDate || s.status === "בוטל") return false;
      const sStartM = toMinutes(s.startTime);
      const sEndM = sStartM + Number(s.durationMinutes);
      return newStartM < sEndM && newEndM > sStartM;
    });
  }

  function handleSave() {
    const traineeId = form.traineeId;
    const date = form.date.trim();
    const startTime = form.startTime.trim();
    const dur = Number(form.durationMinutes);
    const location = form.location.trim();
    if (!traineeId || !date || !startTime || !form.durationMinutes || !location) {
      setFormError("מתאמן, תאריך, שעת התחלה, משך ומיקום הם שדות חובה");
      return;
    }
    if (dur <= 0) {
      setFormError("משך האימון חייב להיות גדול מ-0");
      return;
    }
    if (hasOverlap(date, startTime, dur, sessions)) {
      setFormError("קיים אימון חופף בשעה שנבחרה");
      return;
    }
    const session = {
      id: Date.now().toString(),
      traineeId,
      traineeName: form.traineeName,
      date,
      startTime,
      durationMinutes: dur,
      trainingType: form.trainingType,
      location,
      status: form.status,
      notes: form.notes.trim(),
      createdAt: new Date().toLocaleDateString("he-IL"),
    };
    setSessions((prev) => [...prev, session]);
    setForm({ traineeId: "", traineeName: "", date: "", startTime: "", durationMinutes: "", trainingType: "אישי", location: "", status: "מתוכנן", notes: "" });
    setFormError("");
    setShowForm(false);
  }

  function handleStatusChange(id, newStatus) {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: newStatus } : s));
  }

  function handleDelete(id) {
    if (window.confirm("למחוק אימון זה?")) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  function waLink(traineeId) {
    const t = trainees.find((tr) => tr.id === traineeId);
    if (!t || !t.phone) return null;
    return "https://wa.me/" + t.phone.replace(/\D/g, "");
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const todaySessions = sessions
    .filter((s) => s.date === todayStr && s.status !== "בוטל")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const kpiToday = todaySessions.length;
  const kpiCoord = sessions.filter((s) => s.status === "דורש תיאום").length;

  function calcAvailWindows() {
    const dayStart = 8 * 60;
    const dayEnd = 21 * 60;
    const sorted = [...todaySessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
    let windows = 0;
    let cursor = dayStart;
    for (const s of sorted) {
      const sStart = toMinutes(s.startTime);
      const sEnd = sStart + Number(s.durationMinutes);
      if (sStart - cursor >= 60) windows++;
      cursor = Math.max(cursor, sEnd);
    }
    if (dayEnd - cursor >= 60) windows++;
    return windows;
  }

  const kpiAvail = calcAvailWindows();

  const upcomingSessions = [...sessions]
    .filter((s) => s.date > todayStr && s.status !== "בוטל")
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime))
    .slice(0, 10);

  const coordSessions = sessions.filter((s) => s.status === "דורש תיאום");

  const statusOptions = ["מתוכנן", "הושלם", "בוטל", "דורש תיאום"];
  const trainingTypeOptions = ["אישי", "אונליין", "קבוצתי"];

  const inp = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "0.5px solid #EDEBE6",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#FAF8F5",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>לו"ז</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>ניהול אימונים, זמינות ומעקב יומי</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormError(""); }} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "#7C2D3E", color: "#fff", cursor: "pointer" }}>+ הוסף אימון</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>אימונים היום</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpiToday}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>זמינות</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{kpiAvail} חלונות</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>דורשים תיאום</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{kpiCoord}</div>
        </div>
      </div>
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>הוספת אימון חדש</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>מתאמן *</div>
            {trainees.length === 0 ? (
              <div style={{ fontSize: 14, color: "#9E9A90", padding: "8px 10px", borderRadius: 8, border: "0.5px solid #EDEBE6", background: "#FAF8F5" }}>אין מתאמנים זמינים</div>
            ) : (
              <select value={form.traineeId} onChange={(e) => handleTraineeSelect(e.target.value)} style={inp}>
                <option value="">בחר מתאמן</option>
                {trainees.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>תאריך *</div>
              <input type="date" value={form.date} onChange={(e) => handleField("date", e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>שעת התחלה *</div>
              <input type="time" value={form.startTime} onChange={(e) => handleField("startTime", e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>משך בדקות *</div>
              <input type="number" min="1" value={form.durationMinutes} onChange={(e) => handleField("durationMinutes", e.target.value)} style={inp} placeholder="60" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>סוג אימון</div>
              <select value={form.trainingType} onChange={(e) => handleField("trainingType", e.target.value)} style={inp}>
                {trainingTypeOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>מיקום *</div>
            <input value={form.location} onChange={(e) => handleField("location", e.target.value)} style={inp} placeholder="מיקום האימון" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>סטטוס</div>
            <select value={form.status} onChange={(e) => handleField("status", e.target.value)} style={inp}>
              {statusOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#9E9A90", marginBottom: 4 }}>הערות</div>
            <textarea value={form.notes} onChange={(e) => handleField("notes", e.target.value)} style={{ ...inp, height: 72, resize: "vertical" }} placeholder="הערות נוספות" />
          </div>
          {formError && <div style={{ fontSize: 13, color: "#C0392B", marginBottom: 12 }}>{formError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 8, border: "none", background: "#7C2D3E", color: "#fff", cursor: "pointer" }}>שמור אימון</button>
            <button onClick={() => { setShowForm(false); setFormError(""); }} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "0.5px solid #EDEBE6", background: "#fff", color: "#615E57", cursor: "pointer" }}>ביטול</button>
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>לוח יומי</div>
        {todaySessions.length === 0 ? (
          <div style={{ fontSize: 14, color: "#9E9A90" }}>אין אימונים מתוזמנים היום</div>
        ) : (
          todaySessions.map((s) => {
            const endTime = addMinutes(s.startTime, s.durationMinutes);
            const wa = waLink(s.traineeId);
            return (
              <div key={s.id} style={{ padding: "12px 0", borderBottom: "0.5px solid #EDEBE6" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.traineeName}</div>
                    <div style={{ fontSize: 12, color: "#9E9A90" }}>{s.startTime}–{endTime} ({s.durationMinutes} דק׳) · {s.trainingType}</div>
                    <div style={{ fontSize: 12, color: "#9E9A90" }}>מיקום: {s.location}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={s.status} onChange={(e) => handleStatusChange(s.id, e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #EDEBE6", background: "#FAF8F5", cursor: "pointer" }}>
                      {statusOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#25D366", textDecoration: "none" }}>WA</a>}
                    <button onClick={() => handleDelete(s.id)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "none", background: "#FAF8F5", color: "#C0392B", cursor: "pointer" }}>מחק</button>
                  </div>
                </div>
                {s.notes && <div style={{ fontSize: 12, color: "#9E9A90", marginTop: 2 }}>{s.notes}</div>}
              </div>
            );
          })
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>אימונים קרובים</div>
        {upcomingSessions.length === 0 ? (
          <div style={{ fontSize: 14, color: "#9E9A90" }}>אין אימונים קרובים</div>
        ) : (
          upcomingSessions.map((s) => {
            const endTime = addMinutes(s.startTime, s.durationMinutes);
            const wa = waLink(s.traineeId);
            return (
              <div key={s.id} style={{ padding: "12px 0", borderBottom: "0.5px solid #EDEBE6" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.traineeName}</div>
                    <div style={{ fontSize: 12, color: "#9E9A90" }}>{s.date} · {s.startTime}–{endTime} ({s.durationMinutes} דק׳) · {s.trainingType}</div>
                    <div style={{ fontSize: 12, color: "#9E9A90" }}>מיקום: {s.location}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={s.status} onChange={(e) => handleStatusChange(s.id, e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #EDEBE6", background: "#FAF8F5", cursor: "pointer" }}>
                      {statusOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#25D366", textDecoration: "none" }}>WA</a>}
                    <button onClick={() => handleDelete(s.id)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "none", background: "#FAF8F5", color: "#C0392B", cursor: "pointer" }}>מחק</button>
                  </div>
                </div>
                {s.notes && <div style={{ fontSize: 12, color: "#9E9A90", marginTop: 2 }}>{s.notes}</div>}
              </div>
            );
          })
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>משימות תיאום</div>
        {coordSessions.length === 0 ? (
          <div style={{ fontSize: 14, color: "#9E9A90" }}>אין משימות פתוחות</div>
        ) : (
          coordSessions.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #EDEBE6" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.traineeName}</div>
                <div style={{ fontSize: 12, color: "#9E9A90" }}>{s.location}</div>
              </div>
              <div style={{ fontSize: 13, color: "#7C2D3E" }}>{s.date} · {s.startTime}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


function Revenue() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>Revenue</h2>
        <div style={{ fontSize: 13, color: "#9E9A90", marginTop: 4 }}>Monthly tracking, expenses and financial summary</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>Monthly Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>Expenses</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, color: "#9E9A90", marginBottom: 6 }}>Estimated Net</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>--</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Monthly Revenue</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>Data will appear after connection.</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Expenses</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>Data will appear after connection.</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Financial Summary</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>Data will appear after connection.</div>
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
  reviews:        "סקירות אימונים",
  schedule:       "לוח זמנים",
  revenue:        "הכנסות",
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
      { id: null,       icon: "📝", label: "תוכניות אימון",   disabled: true },
    ],
  },
  {
    label: 'פיננסי ולו"ז',
    items: [
      { id: "schedule", icon: "📅", label: "לוח זמנים" },
      { id: "revenue",  icon: "💰", label: "הכנסות" },
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

  function toggleRole() {
    const next = role === "admin" ? "trainee" : "admin";
    setRole(next);
    setView(next === "admin" ? "dashboard" : "trainee-home");
  }

  const groups = role === "admin" ? ADMIN_GROUPS : TRAINEE_GROUPS;

  return (
    <div className="app" dir="rtl">

      {/* Sidebar */}
      <div className="sidebar">
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
                  onClick={item.disabled ? undefined : () => setView(item.id)}
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

      {/* Main */}
      <div className="main">
        <div className="topbar">
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
          {view === "dashboard"    && <Dashboard />}
          {view === "leads"        && <Leads />}
          {view === "trainees"     && <Trainees />}
          {view === "reviews"      && <Reviews />}
          {view === "schedule"     && <Schedule />}
          {view === "revenue"      && <Revenue />}
          {view === "settings"     && <Settings />}
          {view === "trainee-home" && <TraineeHome />}
          {view === "workout"      && <Workout />}
          {view === "progress"     && <Progress />}
        </div>
      </div>

    </div>
  );
}
