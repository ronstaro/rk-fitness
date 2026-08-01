import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchActivePrograms } from "../services/programsService.js";
import { fetchSessions } from "../services/sessionsService.js";
import { fetchTrainees } from "../services/traineesService.js";
import {
  fetchWeeklyGoalNotes,
  saveWeeklyGoalNote,
} from "../services/weeklyGoalsService.js";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentWeek() {
  const today = new Date();
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  start.setDate(today.getDate() - today.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: dateKey(start), end: dateKey(end) };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export default function WeeklyGoals() {
  const week = useMemo(currentWeek, []);
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [rowError, setRowError] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [trainees, programs, sessions, noteRows] = await Promise.all([
        fetchTrainees(),
        fetchActivePrograms(),
        fetchSessions(),
        fetchWeeklyGoalNotes(week.start),
      ]);
      const programsByTrainee = Object.fromEntries(
        programs.map((program) => [program.trainee_id, program])
      );
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
      const activeTrainees = trainees.filter((trainee) => trainee.status !== "הסתיים");
      setRows(
        activeTrainees.map((trainee) => ({
          trainee,
          program: programsByTrainee[trainee.id] || null,
          completed: completedByTrainee[trainee.id] || 0,
        }))
      );
      const nextNotes = Object.fromEntries(
        noteRows.map((note) => [note.trainee_id, note.note])
      );
      setNotes(nextNotes);
      setDrafts(nextNotes);
    } catch (error) {
      console.error("Weekly goals fetch error:", error);
      setLoadError("לא ניתן לטעון את היעדים השבועיים כרגע.");
    } finally {
      setLoading(false);
    }
  }, [week.end, week.start]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(traineeId) {
    setSavingId(traineeId);
    setRowError((current) => ({ ...current, [traineeId]: "" }));
    try {
      const saved = await saveWeeklyGoalNote({
        traineeId,
        weekStart: week.start,
        note: drafts[traineeId] || "",
      });
      setNotes((current) => ({ ...current, [traineeId]: saved?.note || "" }));
      setDrafts((current) => ({ ...current, [traineeId]: saved?.note || "" }));
    } catch (error) {
      console.error("Weekly goal note save error:", error);
      setRowError((current) => ({
        ...current,
        [traineeId]: "לא ניתן לשמור את ההערה כרגע.",
      }));
    } finally {
      setSavingId("");
    }
  }

  if (loading) return <div className="weekly-goals-state">טוען יעדים שבועיים...</div>;
  if (loadError) {
    return (
      <div className="weekly-goals-state">
        <p>{loadError}</p>
        <button type="button" className="btn btn-burg btn-sm" onClick={load}>ניסיון חוזר</button>
      </div>
    );
  }

  return (
    <div className="weekly-goals-page">
      <div className="page-header weekly-goals-header">
        <div>
          <h2>יעד שבועי למתאמנים</h2>
          <p className="muted text-sm">{formatDate(week.start)}–{formatDate(week.end)} · ראשון עד שבת</p>
        </div>
        <span className="badge badge-burg">{rows.length} מתאמנים</span>
      </div>

      {rows.length === 0 ? (
        <div className="card weekly-goals-state">אין מתאמנים פעילים להצגה.</div>
      ) : (
        <div className="weekly-goals-grid">
          {rows.map(({ trainee, program, completed }) => {
            const target = program?.sessions_per_week || 0;
            const percent = target ? Math.min(100, Math.round((completed / target) * 100)) : 0;
            const reached = target > 0 && completed >= target;
            const status = !target ? "ללא יעד" : reached ? "עמד/ה ביעד" : "בתהליך";
            const statusClass = !target ? "neutral" : reached ? "success" : "warning";
            const hasChanges = (drafts[trainee.id] || "") !== (notes[trainee.id] || "");

            return (
              <article className="weekly-goal-card" key={trainee.id}>
                <div className="weekly-goal-person">
                  <div className="weekly-goal-avatar">{initials(trainee.full_name)}</div>
                  <div>
                    <h3>{trainee.full_name}</h3>
                    <p>{program?.name || "אין תוכנית פעילה"}</p>
                  </div>
                  <span className={`weekly-goal-status ${statusClass}`}>{status}</span>
                </div>

                <div className="weekly-goal-progress">
                  <div className="weekly-goal-score">
                    <strong>{completed}/{target || "—"}</strong>
                    <span>אימונים הושלמו</span>
                  </div>
                  <div className="weekly-goal-meter" aria-label={`${percent}% מהיעד השבועי`}>
                    <span className={statusClass} style={{ width: `${percent}%` }} />
                  </div>
                  <strong className="weekly-goal-percent">{target ? `${percent}%` : "—"}</strong>
                </div>

                <div className="weekly-goal-note">
                  <label htmlFor={`weekly-note-${trainee.id}`}>הערה לשבוע זה</label>
                  <textarea
                    id={`weekly-note-${trainee.id}`}
                    rows="2"
                    maxLength="500"
                    value={drafts[trainee.id] || ""}
                    placeholder="לדוגמה: חופשה, מחלה או התאמה זמנית"
                    onChange={(event) => setDrafts((current) => ({ ...current, [trainee.id]: event.target.value }))}
                  />
                  <div className="weekly-goal-note-actions">
                    {rowError[trainee.id] && <span>{rowError[trainee.id]}</span>}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={!hasChanges || savingId === trainee.id}
                      onClick={() => handleSave(trainee.id)}
                    >
                      {savingId === trainee.id ? "שומר..." : "שמור הערה"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
