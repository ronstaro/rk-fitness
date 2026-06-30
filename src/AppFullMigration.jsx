import { useState } from "react";

export default function AppFullMigration() {
  const [view, setView] = useState("dashboard");
  const titles = { dashboard: "לוח בקרה", leads: "לידים", trainees: "מתאמנים" };
  const base = { padding: "9px 16px", margin: "2px 8px", borderRadius: 8, cursor: "pointer", color: "#615E57" };
  const active = { background: "#F9F0F2", color: "#7C2D3E", fontWeight: 600 };
  return (
    <div dir="rtl" style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: "#FAF8F5" }}>
      <div style={{ width: 210, background: "#fff", borderLeft: "0.5px solid #EDEBE6", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 16px", fontWeight: 700, fontSize: 18, color: "#7C2D3E", borderBottom: "0.5px solid #EDEBE6" }}>
          R.K Fitness
        </div>
        <div style={{ padding: "8px 0" }}>
          <div onClick={() => setView("dashboard")} style={{ ...base, ...(view === "dashboard" ? active : {}) }}>🏠 לוח בקרה</div>
          <div onClick={() => setView("leads")} style={{ ...base, ...(view === "leads" ? active : {}) }}>📥 לידים</div>
          <div onClick={() => setView("trainees")} style={{ ...base, ...(view === "trainees" ? active : {}) }}>👥 מתאמנים</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: 24 }}>
        <h2 style={{ marginBottom: 12, color: "#1E1C19" }}>{titles[view]}</h2>
        <p style={{ color: "#615E57" }}>Migration shell works</p>
      </div>
    </div>
  );
}
