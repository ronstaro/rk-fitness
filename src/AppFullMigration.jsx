import { useState } from "react";

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
          <div style={{ fontSize: 28, fontWeight: 700 }}>4</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>לידים חדשים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>2</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>הכנסה חודשית</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>₪3,400</div>
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

export default function AppFullMigration() {
  const [view, setView] = useState("dashboard");
  const [role, setRole] = useState("admin");
  function toggleRole() {
    const next = role === "admin" ? "trainee" : "admin";
    setRole(next);
    setView(next === "admin" ? "dashboard" : "trainee-home");
  }
  const n = { padding: "9px 16px", margin: "2px 8px", borderRadius: 8, cursor: "pointer", color: "#615E57" };
  const a = { background: "#F9F0F2", color: "#7C2D3E", fontWeight: 600 };
  const s = (id) => view === id ? { ...n, ...a } : n;
  return (
    <div dir="rtl" style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: "#FAF8F5" }}>
      <div style={{ width: 210, background: "#fff", borderLeft: "0.5px solid #EDEBE6", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 16px", fontSize: 18, fontWeight: 700, color: "#7C2D3E", borderBottom: "0.5px solid #EDEBE6" }}>R.K Fitness</div>
        <div style={{ padding: "8px 0", flex: 1 }}>
          <div onClick={() => setView("dashboard")} style={s("dashboard")}>🏠 לוח בקרה</div>
          <div onClick={() => setView("leads")} style={s("leads")}>📥 לידים</div>
          <div onClick={() => setView("trainees")} style={s("trainees")}>👥 מתאמנים</div>
          <div onClick={() => setView("reviews")} style={s("reviews")}>✍️ סקירות</div>
          <div onClick={() => setView("schedule")} style={s("schedule")}>📅 לוח זמנים</div>
          <div onClick={() => setView("revenue")} style={s("revenue")}>💰 הכנסות</div>
          <div onClick={() => setView("settings")} style={s("settings")}>⚙️ הגדרות</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 56, background: "#fff", borderBottom: "0.5px solid #EDEBE6", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between" }}>
          <b style={{ fontSize: 16 }}>{view}</b>
          <button onClick={toggleRole} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, border: "1.5px solid #7C2D3E", background: "transparent", color: "#7C2D3E", cursor: "pointer" }}>
            {role === "admin" ? "מעבר למתאמן" : "מעבר למנהלת"}
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {view === "dashboard" && <Dashboard />}
          {view === "leads" && <Screen title="לידים" />}
          {view === "trainees" && <Screen title="מתאמנים" />}
          {view === "reviews" && <Screen title="סקירת אימונים" />}
          {view === "schedule" && <Screen title="לוח זמנים" />}
          {view === "revenue" && <Screen title="הכנסות" />}
          {view === "settings" && <Screen title="הגדרות" />}
          {view === "trainee-home" && <Screen title="הבית שלי" />}
          {view === "workout" && <Screen title="האימון שלי" />}
          {view === "progress" && <Screen title="ההתקדמות שלי" />}
        </div>
      </div>
    </div>
  );
}

