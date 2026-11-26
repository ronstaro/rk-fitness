import { useEffect, useRef } from "react";
import { compareTopSets, comparisonTagText, heaviestSet, topSetText, weightTrend, signedDelta } from "../lib/exerciseProgress.js";

const SHOWN_SESSIONS = 3;
const CHART_SESSIONS = 6;
const MIN_CHART_SESSIONS = 3;

function shortDate(value) {
  return new Date(value).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function chartDate(value) {
  const date = new Date(value);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// Heaviest set per session, oldest on the left, newest on the right.
function WeightChart({ sessions, best }) {
  const points = sessions
    .slice(0, CHART_SESSIONS)
    .filter((session) => session.top?.weight != null)
    .reverse();
  if (points.length < MIN_CHART_SESSIONS) return null;
  const width = 320;
  const height = 92;
  const values = points.map((session) => session.top.weight);
  const min = Math.min(...values, best?.weight ?? Infinity) - 2.5;
  const max = Math.max(...values, best?.weight ?? -Infinity) + 2.5;
  const x = (index) => 18 + (index * (width - 36)) / (points.length - 1);
  const y = (value) => height - 18 - ((value - min) / (max - min || 1)) * (height - 36);
  const last = points.length - 1;
  return (
    <figure className="history-chart">
      <figcaption>משקל הסט הכבד · {points.length} אימונים אחרונים</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`משקל הסט הכבד: ${values.join(", ")} ק״ג`}>
        {best && <line x1="12" x2={width - 12} y1={y(best.weight)} y2={y(best.weight)} className="history-chart-best" />}
        <polyline points={points.map((session, index) => `${x(index)},${y(session.top.weight)}`).join(" ")} className="history-chart-line" />
        {points.map((session, index) => (
          <circle key={session.workoutId} cx={x(index)} cy={y(session.top.weight)} r={index === last ? 4.5 : 3} className={index === last ? "history-chart-dot last" : "history-chart-dot"} />
        ))}
        {[0, last].map((index) => (
          <g key={index}>
            <text x={x(index)} y={y(points[index].top.weight) - 8} textAnchor="middle" className="history-chart-value">{points[index].top.weight}</text>
            <text x={x(index)} y={height - 3} textAnchor="middle" className="history-chart-date">{chartDate(points[index].completedAt)}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

// The trainee's history of one exercise. Read only: opening or closing it
// never touches the workout, its sets or the rest timer.
export default function ExerciseHistorySheet({ exerciseName, history, onClose, onRetry }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = history?.status ?? "loading";
  const sessions = history?.sessions ?? [];
  const best = heaviestSet(sessions);
  // A "record" label is only shown with enough reliable data.
  const reliable = status === "ready" && !history?.truncated && sessions.length >= 2;
  const trend = status === "ready" && !history?.truncated ? weightTrend(sessions) : null;

  let body;
  if (status === "loading") {
    body = <p className="history-sheet-state" role="status">טוען את ההיסטוריה…</p>;
  } else if (status === "error") {
    body = (
      <div className="history-sheet-state">
        <strong>לא הצלחנו לטעון את ההיסטוריה</strong>
        <p>האימון שלך ממשיך להישמר כרגיל.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>נסה שוב</button>
      </div>
    );
  } else if (sessions.length === 0) {
    body = (
      <div className="history-sheet-state">
        <strong>עדיין אין אימון קודם שהושלם בתרגיל הזה</strong>
        <p>בסיום האימון, הביצוע של היום יישמר כאן ויהיה הבסיס להשוואה בפעם הבאה.</p>
      </div>
    );
  } else {
    const latest = sessions[0];
    body = (
      <>
        <div className="history-sheet-stats">
          <article className="best">
            <span>{reliable ? "שיא משקל" : "המשקל הכבד ביותר"}</span>
            <b>{best ? <bdi dir="ltr">{best.weight}×{best.reps}</bdi> : "—"}</b>
            <small>{best ? `ק״ג × חזרות · ${shortDate(best.completedAt)}` : "ללא משקל"}</small>
          </article>
          <article>
            <span>האימון האחרון · {shortDate(latest.completedAt)}</span>
            <b><bdi dir="ltr">{topSetText(latest.top)}</bdi></b>
            <small>הסט הכבד{latest.sets.find((item) => item.rir != null) ? ` · RIR ${latest.sets.find((item) => item.rir != null).rir}` : ""}</small>
          </article>
        </div>

        <WeightChart sessions={sessions} best={reliable ? best : null} />
        {trend && (
          <p className="history-sheet-trend">
            מגמה ב־{trend.sessions} האימונים האחרונים: {trend.weightDelta === 0 ? "יציב" : <><bdi dir="ltr">{signedDelta(trend.weightDelta)}</bdi> ק״ג בסט הכבד</>}
          </p>
        )}

        <ol className="history-sheet-rows">
          {sessions.slice(0, SHOWN_SESSIONS).map((session, index) => {
            const before = sessions[index + 1];
            const result = before ? compareTopSets(before.top, session.top) : null;
            const tag = comparisonTagText(result);
            return (
              <li key={session.workoutId}>
                <div className="history-row-when">
                  <strong>{shortDate(session.completedAt)}</strong>
                  <small>{session.programName}{session.dayName && ` · ${session.dayName}`}</small>
                </div>
                <div className="history-row-sets">
                  {session.top?.weight == null
                    ? <span><bdi dir="ltr">{session.sets.map((item) => item.reps).join(" · ")}</bdi> חזרות</span>
                    : <bdi dir="ltr">{session.sets.map((item) => (item.weight == null ? `${item.reps}` : `${item.weight}×${item.reps}`)).join(" · ")}</bdi>}
                  {tag && <small className={`history-row-tag ${result.kind}`}>{tag}</small>}
                </div>
              </li>
            );
          })}
        </ol>
        {history?.truncated && <p className="history-sheet-note">מוצגים האימונים האחרונים בלבד.</p>}
      </>
    );
  }

  return (
    <>
      <div className="history-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="history-sheet" role="dialog" aria-modal="true" aria-label={`ההיסטוריה שלי: ${exerciseName}`}>
        <span className="history-sheet-handle" aria-hidden="true" />
        <header className="history-sheet-head">
          <div>
            <strong>{exerciseName}</strong>
            <small>ההיסטוריה שלך בתרגיל · מכל התוכניות</small>
          </div>
          <button type="button" ref={closeRef} className="history-sheet-close" aria-label="סגירת ההיסטוריה" onClick={onClose}>✕</button>
        </header>
        {body}
        <p className="history-sheet-foot">הסגירה מחזירה אותך בדיוק לאותו מקום באימון</p>
      </section>
    </>
  );
}
