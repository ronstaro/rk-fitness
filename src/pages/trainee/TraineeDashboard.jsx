import { useState } from 'react';
import {
  BURG, BURG_PALE, BURG_DARK, MUSTARD_PALE, MUSTARD_D,
  GRAY_100, GRAY_50, GRAY_600, SUCCESS, WARN, DANGER,
  pct, consistencyClass, consistencyColor, isDigital, lsSet,
  MOCK_TRAINEES, initPrograms, initSubmitted, MOCK_SESSIONS,
} from '../../data/mockData.js';

// ── Renewal modal (non-dismissible) ──────────────────────────────────
function RenewalModal({ trainee, onSubmitProof }) {
  const [proof, setProof] = useState(null);
  return (
    <div className="renewal-modal-overlay">
      <div className="modal" style={{ border: `2px solid ${BURG}`, maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>💳</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: BURG, marginBottom: 8 }}>
            חידוש מנוי חודשי
          </div>
        </div>
        <div className="text-sm mb-16" style={{ lineHeight: 1.7, textAlign: 'center' }}>
          המנוי החודשי שלך מסתיים בעוד <strong>3 ימים</strong>.<br />
          כדי להמשיך לקבל אימונים, נא לחדש ולהעלות אישור תשלום.
        </div>
        <div className="form-group">
          <label className="form-label">{`סכום לתשלום: ₪${trainee.packagePrice}`}</label>
          <div className="text-sm muted mb-8">Bit / PayBox / העברה בנקאית</div>
          <div
            style={{
              border: `2px dashed ${GRAY_100}`, borderRadius: 10, padding: 20,
              textAlign: 'center', cursor: 'pointer', background: GRAY_50,
            }}
            onClick={() => setProof('uploaded')}
          >
            {proof
              ? <div style={{ color: SUCCESS, fontWeight: 600 }}>✅ אישור תשלום הועלה</div>
              : <div className="text-sm muted">לחצי להעלאת אישור תשלום</div>}
          </div>
        </div>
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          disabled={!proof}
          onClick={() => onSubmitProof(proof)}
        >
          אשרי חידוש מנוי ✅
        </button>
        <div className="text-xs muted mt-8" style={{ textAlign: 'center' }}>
          לא ניתן לסגור עד לקבלת אישור תשלום
        </div>
      </div>
    </div>
  );
}

// ── circular progress ring (SVG) ─────────────────────────────────────
function ProgressRing({ pct: percent }) {
  const r = 36, stroke = 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const color = percent >= 100 ? SUCCESS : percent >= 50 ? BURG : WARN;
  return (
    <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={45} cy={45} r={r} fill="none" stroke={GRAY_100} strokeWidth={stroke} />
      <circle
        cx={45} cy={45} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text
        x={45} y={45}
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: '45px 45px' }}
        fontSize={16} fontWeight={700} fill={color} fontFamily="var(--font)"
      >
        {percent}%
      </text>
    </svg>
  );
}

// ── session card ──────────────────────────────────────────────────────
function SessionCard({ session }) {
  const isHome = session.location === 'home';
  return (
    <div className="card-sm mb-8 flex-between">
      <div className="flex-gap">
        <div style={{
          width: 46, height: 46, borderRadius: 10,
          background: isHome ? MUSTARD_PALE : BURG_PALE,
          color: isHome ? MUSTARD_D : BURG,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          <span>{session.time.slice(0, 5)}</span>
          <span style={{ fontSize: 10, opacity: .7 }}>{session.date.slice(5)}</span>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{session.locationName}</div>
          <div className="text-sm muted">{session.duration} דקות</div>
        </div>
      </div>
      <span className="badge badge-burg">{session.sessionType === 'zoom' ? 'Zoom' : 'פרונטלי'}</span>
    </div>
  );
}

// ── workout card (tappable) ───────────────────────────────────────────
function WorkoutCard({ workout, onStart }) {
  const hasSupersets = workout.supersets?.length > 0;
  return (
    <div
      className="card"
      style={{
        marginBottom: 12, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,.05)',
      }}
      onClick={onStart}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{workout.name}</div>
        <div className="flex-gap flex-wrap" style={{ gap: 6 }}>
          <span className="tag">{workout.exercises.length} תרגילים</span>
          {hasSupersets && <span className="tag" style={{ background: BURG_PALE, color: BURG }}>כולל סופרסטים</span>}
          {workout.warmup && <span className="tag">חימום</span>}
        </div>
      </div>
      <button
        className="btn btn-primary"
        style={{ flexShrink: 0 }}
        onClick={e => { e.stopPropagation(); onStart(); }}
      >
        ▶ התחלי
      </button>
    </div>
  );
}

// ── feedback preview ──────────────────────────────────────────────────
function FeedbackCard({ submission }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-sm mb-10" style={{ background: BURG_PALE, borderColor: 'transparent' }}>
      <div className="flex-between mb-4" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ fontWeight: 600, fontSize: 14, color: BURG }}>{submission.workoutName}</div>
        <span style={{ fontSize: 12, color: BURG }}>{open ? '▲' : '▼'}</span>
      </div>
      <div className="text-sm" style={{ color: BURG, opacity: .8, lineHeight: 1.6 }}>
        {submission.feedback?.general}
      </div>
      {open && submission.feedback?.exercises?.length > 0 && (
        <div className="mt-8" style={{ borderTop: `0.5px solid ${BURG_PALE}`, paddingTop: 8 }}>
          {submission.feedback.exercises.map(ex => (
            <div key={ex.id} className="flex-between text-sm mb-4">
              <span style={{ color: BURG }}>{ex.note}</span>
              <span style={{
                background: ex.rec === 'increase' ? '#EAF4EE' : ex.rec === 'decrease' ? '#FEE2E2' : GRAY_50,
                color: ex.rec === 'increase' ? SUCCESS : ex.rec === 'decrease' ? DANGER : GRAY_600,
                padding: '2px 8px', borderRadius: 6, fontSize: 11,
              }}>
                {ex.rec === 'increase' ? '⬆ הגדל' : ex.rec === 'decrease' ? '⬇ הקטן' : '= שמור'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────
export default function TraineeDashboard({
  onNav,
  packages = [],
  traineeId,
  showRenewal = false,
  onRenewalProof,
}) {
  // Use first trainee as "me" (the logged-in trainee)
  const me = MOCK_TRAINEES.find(t => t.id === traineeId) || MOCK_TRAINEES[0];
  const program    = initPrograms.find(p => p.id === me.programId);
  const myPkg      = packages.find(p => p.traineeId === me.id);
  const myFeedback = initSubmitted.filter(w => w.traineeId === me.id && w.feedback);
  const upcomingSessions = MOCK_SESSIONS.filter(s => !s.blocked && s.traineeId === me.id).slice(0, 3);

  const comp = pct(me.completedThisWeek, me.weeklyGoal);
  const pkgRemaining = myPkg ? Math.max(0, myPkg.totalSessions - myPkg.usedSessions) : null;

  return (
    <div className="slide-in">
      {/* renewal modal blocks everything */}
      {showRenewal && onRenewalProof && (
        <RenewalModal trainee={me} onSubmitProof={onRenewalProof} />
      )}

      {/* ── hero header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${BURG_PALE} 0%, #fff 100%)`,
        borderRadius: 'var(--radius-lg)', padding: '20px 22px', marginBottom: 20,
        border: `0.5px solid ${GRAY_100}`,
      }}>
        <div className="flex-between flex-wrap" style={{ gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 4 }}>
              שלום, {me.name.split(' ')[0]} 👋
            </div>
            <div className="text-sm muted">המשיכי לדחוף — את עושה עבודה מדהימה!</div>
            <div className="flex-gap flex-wrap mt-8" style={{ gap: 6 }}>
              <span className="badge badge-burg">{me.type === 'online' ? 'מקוון' : me.type === 'hybrid' ? 'היברידי' : 'פרונטלי'}</span>
              <span className="tag">{me.goal}</span>
              {pkgRemaining !== null && (
                <span className={`badge ${pkgRemaining === 1 ? 'badge-warn' : 'badge-burg'}`}>
                  {pkgRemaining === 1 ? '⚠️ נותר שיעור 1' : `${pkgRemaining} שיעורים נותרו`}
                </span>
              )}
            </div>
          </div>
          <ProgressRing pct={comp} />
        </div>

        {/* weekly progress bar */}
        <div className="mt-16">
          <div className="flex-between text-sm mb-6">
            <span className="muted">יעד שבועי</span>
            <span style={{ fontWeight: 600, color: consistencyColor(comp) }}>
              {me.completedThisWeek} / {me.weeklyGoal} אימונים
            </span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div
              className={`progress-fill ${consistencyClass(comp)}`}
              style={{ width: `${Math.min(comp, 100)}%` }}
            />
          </div>
          <div className="flex-gap mt-8 flex-wrap" style={{ gap: 6 }}>
            <span className="tag">עקביות {me.consistency}%</span>
            <span className="tag">אימון אחרון: {me.lastWorkout}</span>
          </div>
        </div>
      </div>

      {/* ── package warning ── */}
      {pkgRemaining === 1 && (
        <div className="alert-strip warn mb-16">
          ⚠️ נשאר לך עוד אימון אחד בכרטיסייה. רוצה לחדש כדי שנמשיך בלי עצירות? 💪
        </div>
      )}

      {/* ── CTA: book session ── */}
      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%', justifyContent: 'center', gap: 12, marginBottom: 20, fontSize: 16 }}
        onClick={() => onNav?.('booking')}
      >
        <span style={{ fontSize: 22 }}>📅</span>
        קביעת אימון עם רוני
      </button>

      {/* ── this week's workouts ── */}
      {program && program.workouts.length > 0 && (
        <div className="mb-20">
          <div className="section-title">האימונים שלי 💪</div>
          {program.workouts.map(w => (
            <WorkoutCard
              key={w.id}
              workout={w}
              onStart={() => onNav?.('do-workout', w)}
            />
          ))}
        </div>
      )}

      {/* ── upcoming sessions ── */}
      {upcomingSessions.length > 0 && (
        <div className="mb-20">
          <div className="section-title">שיעורים קרובים 📅</div>
          {upcomingSessions.map(s => <SessionCard key={s.id} session={s} />)}
        </div>
      )}

      {/* ── coach feedback ── */}
      {myFeedback.length > 0 && (
        <div className="mb-20">
          <div className="section-title">💬 משוב מרוני</div>
          {myFeedback.map(w => <FeedbackCard key={w.id} submission={w} />)}
        </div>
      )}

      {/* ── quick stats row ── */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="metric">
          <div className="metric-label">עקביות</div>
          <div className="metric-value" style={{ fontSize: 22, color: consistencyColor(me.consistency) }}>
            {me.consistency}%
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">אימונים השבוע</div>
          <div className="metric-value" style={{ fontSize: 22, color: BURG }}>
            {me.completedThisWeek}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">יעד שבועי</div>
          <div className="metric-value" style={{ fontSize: 22 }}>
            {me.weeklyGoal}
          </div>
        </div>
      </div>
    </div>
  );
}