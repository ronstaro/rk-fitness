import { useEffect, useMemo, useState } from "react";
import { fetchLeads } from "../services/leadsService.js";
import { fetchDashboardPayments } from "../services/dashboardService.js";
import { fetchActivePrograms } from "../services/programsService.js";
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

function monthStartKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function weekRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: localDateKey(start), end: localDateKey(end) };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value || 0);
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
  const [programs, setPrograms] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setLoadError("");

    try {
      const [leadRows, traineeRows, sessionRows, programRows, paymentRows] = await Promise.all([
        fetchLeads(),
        fetchTrainees(),
        fetchSessions(),
        fetchActivePrograms(),
        fetchDashboardPayments(monthStartKey()),
      ]);
      setLeads(leadRows);
      setTrainees(traineeRows);
      setSessions(sessionRows);
      setPrograms(programRows);
      setPayments(paymentRows);
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
    const week = weekRange(today);
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
    const unpaidPayments = payments.filter((payment) => payment.payment_status === "unpaid");
    const monthlyIncome = payments
      .filter((payment) => payment.payment_status === "paid")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
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

    const upcomingSessions = sessions
      .filter(
        (session) =>
          session.status !== "בוטל" &&
          (session.session_date > todayKey ||
            (session.session_date === todayKey &&
              formatTime(session.start_time) >= today.toTimeString().slice(0, 5)))
      )
      .slice(0, 4);
    const completedByTrainee = sessions.reduce((result, session) => {
      if (
        session.status === "הושלם" &&
        session.session_date >= week.start &&
        session.session_date <= week.end
      ) {
        result[session.trainee_id] = (result[session.trainee_id] || 0) + 1;
      }
      return result;
    }, {});
    const programByTrainee = Object.fromEntries(
      programs.map((program) => [program.trainee_id, program])
    );
    const weeklyProgress = activeTrainees
      .map((trainee) => {
        const target = Number(programByTrainee[trainee.id]?.sessions_per_week || 0);
        const completed = completedByTrainee[trainee.id] || 0;
        return {
          trainee,
          target,
          completed,
          percent: target ? Math.min(100, Math.round((completed / target) * 100)) : 0,
        };
      })
      .filter((row) => row.target > 0)
      .sort((a, b) => a.percent - b.percent);

    return {
      todaySessions,
      activeTrainees,
      newLeads,
      followUps,
      unpaidPayments,
      monthlyIncome,
      birthdays,
      upcomingSessions,
      weeklyProgress,
      traineeNames,
    };
  }, [leads, payments, programs, sessions, trainees]);

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
    dashboard.unpaidPayments.length +
    dashboard.birthdays.length;

  return (
    <div className="dashboard-today">
      <section className="dashboard-welcome dashboard-welcome-plain">
        <div>
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
          className="btn btn-burg"
          onClick={() => onNavigate("schedule")}
        >
          + הוספת אימון
        </button>
      </section>

      <section className="dashboard-stats dashboard-stats-wide" aria-label="נתוני לוח הבקרה">
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
        <button type="button" className="dashboard-stat-card dashboard-stat-income" onClick={() => onNavigate("revenue")}>
          <span>הכנסה חודשית</span>
          <strong>{formatCurrency(dashboard.monthlyIncome)}</strong>
          <small>מתשלומים שסומנו כשולמו</small>
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
        <button type="button" className="dashboard-stat-card" onClick={() => onNavigate("weekly-goals")}>
          <span>יעדים שבועיים</span>
          <strong>{dashboard.weeklyProgress.filter((row) => row.completed >= row.target).length}</strong>
          <small>מתוך {dashboard.weeklyProgress.length} עם יעד פעיל</small>
        </button>
      </section>

      <div className="dashboard-main-grid">
        <section className="card dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h3>אימונים קרובים</h3>
              <p>האימונים הבאים ביומן</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate("schedule")}
            >
              ללוח המלא
            </button>
          </div>

          {dashboard.upcomingSessions.length === 0 ? (
            <div className="dashboard-empty">
              אין אימונים קרובים ביומן.
            </div>
          ) : (
            <div className="dashboard-session-list">
              {dashboard.upcomingSessions.map((session) => (
                <button
                  type="button"
                  className="dashboard-session-row"
                  key={session.id}
                  onClick={() => onNavigate("schedule")}
                >
                  <div className="dashboard-session-time">
                    {session.session_date === localDateKey() ? "היום" : formatDate(session.session_date)}<small>{formatTime(session.start_time)}</small>
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
              {dashboard.unpaidPayments.slice(0, 3).map((payment) => (
                <button
                  type="button"
                  className="dashboard-task-row"
                  key={`payment-${payment.id}`}
                  onClick={() => onNavigate("revenue")}
                >
                  <span className="dashboard-task-icon">💳</span>
                  <span>
                    <strong>תשלום ממתין: {payment.trainee_name}</strong>
                    <small>{formatCurrency(payment.amount)}</small>
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

      <section className="card dashboard-panel dashboard-weekly-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h3>מצב מתאמנים — השבוע</h3>
            <p>התקדמות מול היעד שבתוכנית הפעילה</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("weekly-goals")}>הצג הכל</button>
        </div>
        {dashboard.weeklyProgress.length === 0 ? (
          <div className="dashboard-empty">אין עדיין מתאמנים עם יעד שבועי פעיל.</div>
        ) : (
          <div className="dashboard-weekly-list">
            {dashboard.weeklyProgress.slice(0, 5).map((row) => (
              <button type="button" className="dashboard-weekly-row" key={row.trainee.id} onClick={() => onNavigate("weekly-goals")}>
                <strong>{row.trainee.full_name}</strong>
                <span>{row.completed}/{row.target} אימונים</span>
                <div className="dashboard-weekly-meter"><i style={{ width: `${row.percent}%` }} /></div>
                <small>{row.percent}%</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
