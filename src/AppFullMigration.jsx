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


function Leads() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>לידים</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>ניהול פניות ומעקב</p>
        </div>
        <button style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "#7C2D3E", color: "#fff", cursor: "pointer" }}>+ הוסף ליד</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>לידים חדשים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>למעקב</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>הומרו למתאמנים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>רשימת לידים</div>
        <div style={{ fontSize: 14, color: "#9E9A90", textAlign: "center", padding: "24px 0" }}>אין לידים להצגה עדיין</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>תזכורות מעקב</div>
        <div style={{ fontSize: 14, color: "#9E9A90" }}>אין תזכורות פעילות</div>
      </div>
    </div>
  );
}


function Trainees() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1E1C19" }}>מתאמנים</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9E9A90" }}>ניהול מתאמנים, סטטוס ותוכניות</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>מתאמנים פעילים</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>אונליין / פרונטלי</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #EDEBE6", padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9E9A90", marginBottom: 6 }}>דורשים מעקב</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #EDEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 13, padding: "6px 14px", borderRadius: 20, background: "#F9F0F2", color: "#7C2D3E", fontWeight: 600 }}>הכל</div>
          <div style={{ fontSize: 13, padding: "6px 14px", borderRadius: 20, color: "#615E57" }}>פעילים</div>
          <div style={{ fontSize: 13, padding: "6px 14px", borderRadius: 20, color: "#615E57" }}>מעקב</div>
        </div>
        <div style={{ fontSize: 14, color: "#9E9A90", textAlign: "center", padding: "24px 0" }}>אין מתאמנים להצגה עדיין</div>
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
          {view === "leads" && <Leads />}
          {view === "trainees" && <Trainees />}
          {view === "reviews" && <Screen title="סקירת אימונים" />}
          {view === "schedule" && <Screen title="לוח זמנים" />}
          {view === "revenue" && <Screen title="הכנסות" />}
          {view === "settings" && <Screen title="הגדרות" />}
          {view === "trainee-home" && <TraineeHome />}
          {view === "workout" && <Workout />}
          {view === "progress" && <Progress />}
        </div>
      </div>
    </div>
  );
}






