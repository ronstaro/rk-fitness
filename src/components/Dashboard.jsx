import { useEffect, useMemo, useState } from "react";
import { fetchLeads } from "../services/leadsService.js";
import { fetchSessions } from "../services/sessionsService.js";
import { fetchTrainees } from "../services/traineesService.js";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  return value ? value.slice(0, 5) : "";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

function daysUntilBirthday(birthDate, today = new Date()) {
  if (!birthDate) return null;

  const [, month, day] = birthDate.split("-").map(Number);
  const birthday = new Date(today.getFullYear(), month - 1, day, 12);
  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12
  );

  if (birthday < current) birthday.setFullYear(birthday.getFullYear() + 1);
  return Math.round((birthday - current) / 86400000);
}

export default function Dashboard({ onNavigate }) {
  const [leads, setLeads] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setLoadError("");

    try {
      const [leadRows, traineeRows, sessionRows] = await Promise.all([
        fetchLeads(),
        fetchTrainees(),
        fetchSessions(),
      ]);
      setLeads(leadRows);
      setTrainees(traineeRows);
      setSessions(sessionRows);
    } catch (error) {
      console.error("Dashboard load error:", error);
      setLoadError("לא ניתן לטעון את נתוני היום כרגע.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const dashboard = useMemo(() => {
    const today = new Date();
    const todayKey = localDateKey(today);
    const traineeNames = Object.fromEntries(
      trainees.map((trainee) => [trainee.id, trainee.full_name])
    );
    const closedLeadStatuses = new Set(["הומר למתאמן", "לא רלוונטי"]);

    const todaySessions = sessions.filter(
      (session) => session.session_date === todayKey
    );
    const activeTrainees = trainees.filter(
      (trainee) => trainee.status === "פעיל"
    );
    const newLeads = leads.filter((lead) => lead.status === "חדש");
    const followUps = leads
      .filter(
        (lead) =>
          lead.follow_up_date &&
          lead.follow_up_date <= todayKey &&
          !closedLeadStatuses.has(lead.status)
      )
      .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
    const payments = trainees
      .filter(
        (trainee) =>
          trainee.status === "פעיל" &&
          trainee.next_payment_date &&
          trainee.next_payment_date <= todayKey &&
          trainee.payment_status !== "שולם"
      )
      .sort((a, b) =>
        a.next_payment_date.localeCompare(b.next_payment_date)
      );
    const birthdays = trainees
      .map((trainee) => ({
        ...trainee,
        birthdayInDays: daysUntilBirthday(trainee.birth_date, today),
      }))
      .filter(
        (trainee) =>
          trainee.birthdayInDays !== null && trainee.birthdayInDays <= 7
      )
      .sort((a, b) => a.birthdayInDays - b.birthdayInDays);

    return {
      todaySessions,
      activeTrainees,
      newLeads,
      followUps,
      payments,
      birthdays,
      traineeNames,
    };
  }, [leads, sessions, trainees]);

  if (loading) {
    return (
      <div className="dashboard-state" role="status">
        טוען את נתוני היום...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dashboard-state">
        <div className="dashboard-error">{loadError}</div>
        <button type="button" className="btn btn-primary" onClick={loadDashboard}>
          נסה שוב
        </button>
      </div>
    );
  }

  const openTasks =
    dashboard.followUps.length +
    dashboard.payments.length +
    dashboard.birthdays.length;

  return (
    <div className="dashboard-today">
      <section className="dashboard-welcome">
        <div>
          <div className="dashboard-eyebrow">מרכז היום</div>
          <h2>שלום, רוני ✨</h2>
          <p>
            {new Date().toLocaleDateString("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <button
          type="button"
          className="btn dashboard-light-button"
          onClick={() => onNavigate("schedule")}
        >
          + הוספת אימון
        </button>
      </section>

      <section className="dashboard-stats" aria-label="נתוני היום">
        <button
          type="button"
          className="dashboard-stat-card"
          onClick={() => onNavigate("schedule")}
        >
          <span>אימונים היום</span>
          <strong>{dashboard.todaySessions.length}</strong>
          <small>
            {
              dashboard.todaySessions.filter(
                (session) => session.status === "הושלם"
              ).length
            }{" "}
            הושלמו
          </small>
        </button>
        <button
          type="button"
          className="dashboard-stat-card"
          onClick={() => onNavigate("trainees")}
        >
          <span>מתאמנים פעילים</span>
          <strong>{dashboard.activeTrainees.length}</strong>
          <small>מתוך {trainees.length} מתאמנים</small>
        </button>
        <button
          type="button"
          className="dashboard-stat-card"
          onClick={() => onNavigate("leads")}
        >
          <span>לידים חדשים</span>
          <strong>{dashboard.newLeads.length}</strong>
          <small>{dashboard.followUps.length} ממתינים למעקב</small>
        </button>
        <div className="dashboard-stat-card dashboard-stat-card-static">
          <span>משימות פתוחות</span>
          <strong>{openTasks}</strong>
          <small>מעקבים, תשלומים וימי הולדת</small>
        </div>
      </section>

      <div className="dashboard-main-grid">
        <section className="card dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h3>לוח הזמנים להיום</h3>
              <p>{dashboard.todaySessions.length} אימונים מתוכננים</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate("schedule")}
            >
              ללוח המלא
            </button>
          </div>

          {dashboard.todaySessions.length === 0 ? (
            <div className="dashboard-empty">
              אין אימונים מתוכננים להיום.
            </div>
          ) : (
            <div className="dashboard-session-list">
              {dashboard.todaySessions.map((session) => (
                <button
                  type="button"
                  className="dashboard-session-row"
                  key={session.id}
                  onClick={() => onNavigate("schedule")}
                >
                  <div className="dashboard-session-time">
                    {formatTime(session.start_time)}
                  </div>
                  <div className="dashboard-session-info">
                    <strong>
                      {dashboard.traineeNames[session.trainee_id] ||
                        "זמן חסום"}
                    </strong>
                    <span>
                      {session.training_type} · {session.location}
                    </span>
                  </div>
                  <span
                    className={`badge ${
                      session.status === "הושלם"
                        ? "badge-active"
                        : session.status === "בוטל"
                          ? "badge-inactive"
                          : "badge-new"
                    }`}
                  >
                    {session.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h3>דורש תשומת לב</h3>
              <p>הדברים שכדאי לסגור היום</p>
            </div>
          </div>

          {openTasks === 0 ? (
            <div className="dashboard-empty">אין משימות פתוחות כרגע 🎉</div>
          ) : (
            <div className="dashboard-task-list">
              {dashboard.followUps.slice(0, 4).map((lead) => (
                <button
                  type="button"
                  className="dashboard-task-row"
                  key={`lead-${lead.id}`}
                  onClick={() => onNavigate("leads")}
                >
                  <span className="dashboard-task-icon">📥</span>
                  <span>
                    <strong>מעקב ליד: {lead.full_name}</strong>
                    <small>{formatDate(lead.follow_up_date)}</small>
                  </span>
                </button>
              ))}
              {dashboard.payments.slice(0, 3).map((trainee) => (
                <button
                  type="button"
                  className="dashboard-task-row"
                  key={`payment-${trainee.id}`}
                  onClick={() => onNavigate("trainees")}
                >
                  <span className="dashboard-task-icon">💳</span>
                  <span>
                    <strong>בדיקת תשלום: {trainee.full_name}</strong>
                    <small>{formatDate(trainee.next_payment_date)}</small>
                  </span>
                </button>
              ))}
              {dashboard.birthdays.slice(0, 3).map((trainee) => (
                <button
                  type="button"
                  className="dashboard-task-row"
                  key={`birthday-${trainee.id}`}
                  onClick={() => onNavigate("trainees")}
                >
                  <span className="dashboard-task-icon">🎂</span>
                  <span>
                    <strong>יום הולדת: {trainee.full_name}</strong>
                    <small>
                      {trainee.birthdayInDays === 0
                        ? "היום"
                        : `בעוד ${trainee.birthdayInDays} ימים`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
