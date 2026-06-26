import { useState } from 'react';
import {
  BURG, BURG_PALE, GRAY_100, GRAY_50, WARN,
  calcRisk, openWA, uid,
  WA_TEMPLATES,
  MOCK_TRAINEES, initLeads, initSubmitted, initNotifs,
} from '../../data/mockData.js';

// ── inline WAModal (small, self-contained) ──────────────────────────
function WAModal({ person, onClose }) {
  const [chosen, setChosen] = useState(WA_TEMPLATES[0].id);
  const tpl = WA_TEMPLATES.find(t => t.id === chosen) || WA_TEMPLATES[0];
  const msg = tpl.text(person.name || '');
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-title">שלח WhatsApp</div>
        <div className="form-group">
          <label className="form-label">תבנית</label>
          <select className="form-select" value={chosen} onChange={e => setChosen(e.target.value)}>
            {WA_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">הודעה</label>
          <div style={{ background: GRAY_50, borderRadius: 8, padding: '12px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {msg}
          </div>
        </div>
        <div className="text-sm muted mb-12">{person.phone || '—'}</div>
        <div className="flex-gap">
          <button className="btn btn-whatsapp" onClick={() => { openWA(person.phone || '', msg); onClose(); }}>
            פתח WhatsApp
          </button>
          <button className="btn btn-outline" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ── reusable section wrapper ─────────────────────────────────────────
function Section({ title, count, countCls, emptyMsg, children }) {
  return (
    <div className="today-section">
      <div className="today-section-head">
        <div className="today-section-title">{title}</div>
        <span className={`today-section-count ${countCls}`}>{count}</span>
      </div>
      {count === 0
        ? <div style={{ color: '#9E9A90', fontSize: 13, padding: '8px 0' }}>{emptyMsg}</div>
        : children}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────
export default function TodayScreen({
  trainees = MOCK_TRAINEES,
  sessions = [],
  submitted = initSubmitted,
  bookingRequests = [],
  setBookingRequests,
  setSessions,
  packages = [],
  onNav,
}) {
  const [waTarget, setWaTarget] = useState(null);
  const leads = initLeads;

  const today = new Date().toISOString().slice(0, 10);

  // derived lists
  const pendingReviews  = submitted.filter(w => w.status === 'pending_review');
  const followUps       = leads.filter(l => l.status === 'followUp' && l.followUpDate && l.followUpDate <= today);
  const endingSoon      = trainees.filter(tr => {
    if (!tr.programEnd) return false;
    const d = Math.ceil((new Date(tr.programEnd) - new Date()) / 86400000);
    return d >= 0 && d <= 7;
  });
  const unpaid          = trainees.filter(tr => tr.paymentStatus === 'unpaid');
  const pendingBookings = bookingRequests.filter(r => r.status === 'pending');
  const pkgAlerts       = packages.filter(p => Math.max(0, p.totalSessions - p.usedSessions) === 1);
  const highRisk        = trainees
    .filter(tr => calcRisk(tr, sessions).level !== 'low')
    .sort((a, b) => calcRisk(b, sessions).score - calcRisk(a, sessions).score);

  const now = new Date();
  const birthdaysThisWeek = trainees.filter(tr => {
    if (!tr.birthday) return false;
    const bd = new Date(tr.birthday);
    bd.setFullYear(now.getFullYear());
    const diff = (bd - now) / 86400000;
    return diff >= -1 && diff <= 7;
  });

  const totalTasks = pendingReviews.length + followUps.length + endingSoon.length
    + unpaid.length + pendingBookings.length;

  const dayDiff = date => {
    const d = Math.floor((new Date() - new Date(date)) / 86400000);
    if (d === 0) return 'היום';
    if (d === 1) return 'אתמול';
    return `לפני ${d} ימים`;
  };

  function approveBooking(br) {
    if (!setSessions || !setBookingRequests) return;
    setSessions(prev => [...prev, {
      id: uid(), traineeId: br.traineeId, traineeName: br.traineeName,
      date: br.date, time: br.time, endTime: '', duration: 60,
      sessionType: br.type === 'zoom' ? 'online' : 'inPerson',
      location: br.type === 'zoom' ? 'online' : 'home',
      locationName: br.type === 'zoom' ? 'Zoom' : 'בית הלקוח',
      address: '', bufferMinutes: 10, packageId: br.packageId || '',
      sessionNumber: null, completed: false, blocked: false, notes: '',
    }]);
    setBookingRequests(prev => prev.map(r => r.id === br.id ? { ...r, status: 'approved' } : r));
  }

  function rejectBooking(id) {
    if (!setBookingRequests) return;
    setBookingRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
  }

  return (
    <div className="slide-in">
      {waTarget && <WAModal person={waTarget} onClose={() => setWaTarget(null)} />}

      {/* header */}
      <div className="page-header">
        <div className="page-header-title">היום ✦</div>
        <div className="page-header-sub">{totalTasks} פעולות ממתינות • {today}</div>
      </div>

      {/* ── booking approvals ── */}
      <Section
        title="📅 בקשות קביעת שיעור"
        count={pendingBookings.length}
        countCls={pendingBookings.length > 0 ? 'count-warn' : 'count-ok'}
        emptyMsg="אין בקשות ממתינות"
      >
        {pendingBookings.map(br => (
          <div key={br.id} className="today-card warn-border">
            <div className="avatar">{br.traineeName?.[0] ?? '?'}</div>
            <div className="today-card-content">
              <div className="today-card-title">{br.traineeName}</div>
              <div className="today-card-sub">
                {br.type === 'zoom' ? 'Zoom' : 'פרונטלי'} • {br.date} {br.time}
                {br.paymentProofRef && ' • אסמכתא הועלתה'}
              </div>
              <div className="today-card-actions">
                <button className="btn btn-sm btn-success" onClick={() => approveBooking(br)}>✅ אשר</button>
                <button className="btn btn-sm btn-danger"  onClick={() => rejectBooking(br.id)}>❌ דחה</button>
                <button className="btn btn-sm btn-whatsapp"
                  onClick={() => setWaTarget({ name: br.traineeName, phone: trainees.find(t => t.id === br.traineeId)?.phone || '' })}>
                  WA
                </button>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── high-risk trainees ── */}
      <Section
        title="⚠️ מתאמנים בסיכון"
        count={highRisk.length}
        countCls={highRisk.length > 0 ? 'count-danger' : 'count-ok'}
        emptyMsg="כל המתאמנים בסדר 🎉"
      >
        {highRisk.map(tr => {
          const r = calcRisk(tr, sessions);
          return (
            <div key={tr.id} className={`today-card ${r.level === 'high' ? 'urgent' : 'warn-border'}`}>
              <div className="avatar">{tr.avatar}</div>
              <div className="today-card-content">
                <div className="today-card-title">
                  {tr.name}{' '}
                  <span className={`badge ${r.cls}`} style={{ fontSize: 11 }}>{r.label}</span>
                </div>
                <div className="today-card-sub">{r.reasons.join(' • ')}</div>
                <div className="today-card-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => onNav?.('trainee-profile', tr)}>פרופיל</button>
                  <button className="btn btn-sm btn-whatsapp" onClick={() => setWaTarget(tr)}>WA</button>
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      {/* ── pending reviews ── */}
      <Section
        title="📋 אימונים לסקירה"
        count={pendingReviews.length}
        countCls={pendingReviews.length > 0 ? 'count-warn' : 'count-ok'}
        emptyMsg="אין אימונים ממתינים לסקירה 🎉"
      >
        {pendingReviews.map(w => (
          <div key={w.id} className="today-card">
            <div className="avatar">{w.traineeName?.[0] ?? '?'}</div>
            <div className="today-card-content">
              <div className="today-card-title">{w.traineeName}</div>
              <div className="today-card-sub">{w.workoutName} • הוגש {dayDiff(w.date)}</div>
              <div className="today-card-actions">
                <button className="btn btn-sm btn-primary" onClick={() => onNav?.('reviews')}>סקור</button>
                <button className="btn btn-sm btn-whatsapp"
                  onClick={() => setWaTarget(trainees.find(t => t.id === w.traineeId) || { name: w.traineeName, phone: '' })}>
                  WA
                </button>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── package expiry alerts ── */}
      {pkgAlerts.length > 0 && (
        <Section
          title="📦 כרטיסיות מסתיימות — נשאר שיעור אחד"
          count={pkgAlerts.length}
          countCls="count-warn"
          emptyMsg=""
        >
          {pkgAlerts.map(pkg => {
            const tr = trainees.find(t => t.id === pkg.traineeId);
            if (!tr) return null;
            return (
              <div key={pkg.id} className="today-card warn-border">
                <div className="avatar">{tr.avatar}</div>
                <div className="today-card-content">
                  <div className="today-card-title">{tr.name}</div>
                  <div className="today-card-sub">{pkg.packageName}</div>
                  <div className="today-card-actions">
                    <button className="btn btn-sm btn-whatsapp" onClick={() => setWaTarget(tr)}>WA חידוש</button>
                  </div>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── follow-ups ── */}
      <Section
        title="📞 לידים למעקב"
        count={followUps.length}
        countCls={followUps.length > 0 ? 'count-warn' : 'count-ok'}
        emptyMsg="אין לידים למעקב היום"
      >
        {followUps.map(l => (
          <div key={l.id} className="today-card urgent">
            <div className="avatar">{l.name[0]}</div>
            <div className="today-card-content">
              <div className="today-card-title">{l.name}</div>
              <div className="today-card-sub">{l.phone} • מעקב: {l.followUpDate}</div>
              <div className="today-card-actions">
                <button className="btn btn-sm btn-outline" onClick={() => onNav?.('leads')}>פתח ליד</button>
                <button className="btn btn-sm btn-whatsapp" onClick={() => setWaTarget(l)}>WA</button>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── ending programs ── */}
      <Section
        title="⏰ תוכניות מסתיימות השבוע"
        count={endingSoon.length}
        countCls={endingSoon.length > 0 ? 'count-warn' : 'count-ok'}
        emptyMsg="אין תוכניות מסתיימות השבוע"
      >
        {endingSoon.map(tr => {
          const d = Math.ceil((new Date(tr.programEnd) - new Date()) / 86400000);
          return (
            <div key={tr.id} className="today-card warn-border">
              <div className="avatar">{tr.avatar}</div>
              <div className="today-card-content">
                <div className="today-card-title">{tr.name}</div>
                <div className="today-card-sub">
                  מסתיימת בעוד <strong>{d} ימים</strong> • {tr.programEnd}
                </div>
                <div className="today-card-actions">
                  <button className="btn btn-sm btn-outline" onClick={() => onNav?.('programs')}>חדש תוכנית</button>
                  <button className="btn btn-sm btn-whatsapp" onClick={() => setWaTarget(tr)}>WA</button>
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      {/* ── unpaid ── */}
      <Section
        title="💳 תשלומים פתוחים"
        count={unpaid.length}
        countCls={unpaid.length > 0 ? 'count-warn' : 'count-ok'}
        emptyMsg="כל התשלומים מסודרים 🎉"
      >
        {unpaid.map(tr => (
          <div key={tr.id} className="today-card">
            <div className="avatar">{tr.avatar}</div>
            <div className="today-card-content">
              <div className="today-card-title">{tr.name}</div>
              <div className="today-card-sub">
                {`₪${tr.packagePrice} • פירעון: ${tr.nextPayment}`}
              </div>
              <div className="today-card-actions">
                <button className="btn btn-sm btn-whatsapp" onClick={() => setWaTarget(tr)}>WA תזכורת</button>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── birthdays ── */}
      {birthdaysThisWeek.length > 0 && (
        <Section
          title="🎂 ימי הולדת השבוע"
          count={birthdaysThisWeek.length}
          countCls="count-neutral"
          emptyMsg=""
        >
          {birthdaysThisWeek.map(tr => (
            <div key={tr.id} className="today-card">
              <div className="avatar">{tr.avatar}</div>
              <div className="today-card-content">
                <div className="today-card-title">{tr.name}</div>
                <div className="today-card-sub">יום הולדת: {tr.birthday}</div>
                <div className="today-card-actions">
                  <button className="btn btn-sm btn-whatsapp" onClick={() => setWaTarget({ ...tr, _tpl: 'birthday' })}>
                    ברכה WA 🎉
                  </button>
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}