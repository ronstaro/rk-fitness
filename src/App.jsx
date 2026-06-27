import { useState, useEffect } from 'react';
import Layout from './components/Layout.jsx';
import ProgressSimple from './pages/trainee/ProgressSimple.jsx';

function Placeholder({ title }) {
  return (
    <div className="card">
      <div className="page-header">
        <div className="page-header-title">{title}</div>
        <div className="page-header-sub">העמוד ייבנה בשלב הבא</div>
      </div>
      <div className="empty-state">
        <div className="empty-icon">🚧</div>
        <div>בקרוב נוסיף כאן את המסך המלא</div>
      </div>
    </div>
  );
}

function TodaySimple() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">היום ✦</div>
        <div className="page-header-sub">כל מה שרוני צריכה לטפל בו היום</div>
      </div>

      <div className="metric-grid">
        <div className="metric burg">
          <div className="metric-label">אימונים לסקירה</div>
          <div className="metric-value">3</div>
          <div className="metric-sub">ממתינים למשוב</div>
        </div>

        <div className="metric mustard">
          <div className="metric-label">לידים למעקב</div>
          <div className="metric-value">2</div>
          <div className="metric-sub">צריך לחזור אליהם</div>
        </div>

        <div className="metric">
          <div className="metric-label">חידוש כרטיסיות</div>
          <div className="metric-value">1</div>
          <div className="metric-sub">אימון אחד לפני סיום</div>
        </div>

        <div className="metric">
          <div className="metric-label">ימי הולדת</div>
          <div className="metric-value">4</div>
          <div className="metric-sub">החודש</div>
        </div>
      </div>

      <div className="today-section">
        <div className="today-section-head">
          <div className="today-section-title">משימות דחופות</div>
          <span className="today-section-count count-warn">3</span>
        </div>

        <div className="today-card urgent">
          <div className="today-card-content">
            <div className="today-card-title">מיה שלחה אימון לסקירה</div>
            <div className="today-card-sub">ממתין למשוב מאתמול בערב</div>
            <div className="today-card-actions">
              <button className="btn btn-primary btn-sm">סקירת אימון</button>
              <button className="btn btn-whatsapp btn-sm">WhatsApp</button>
            </div>
          </div>
        </div>

        <div className="today-card warn-border">
          <div className="today-card-content">
            <div className="today-card-title">דור נשאר עם אימון אחד בכרטיסיה</div>
            <div className="today-card-sub">כדאי לשלוח הודעת חידוש</div>
            <div className="today-card-actions">
              <button className="btn btn-primary btn-sm">שלח חידוש</button>
              <button className="btn btn-whatsapp btn-sm">WhatsApp</button>
            </div>
          </div>
        </div>

        <div className="today-card">
          <div className="today-card-content">
            <div className="today-card-title">ליד חדש מאינסטגרם</div>
            <div className="today-card-sub">נועה ביקשה פרטים על ליווי אונליין</div>
            <div className="today-card-actions">
              <button className="btn btn-outline btn-sm">פתח ליד</button>
              <button className="btn btn-whatsapp btn-sm">WhatsApp</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadsSimple() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">לידים</div>
        <div className="page-header-sub">ניהול פניות חדשות ומעקב</div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>שם</th>
              <th>מקור</th>
              <th>סטטוס</th>
              <th>פעולה</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>נועה כהן</td>
              <td>Instagram</td>
              <td><span className="badge badge-new">חדש</span></td>
              <td><button className="btn btn-whatsapp btn-sm">WhatsApp</button></td>
            </tr>
            <tr>
              <td>דניאל לוי</td>
              <td>חבר/ה</td>
              <td><span className="badge badge-warn">מעקב</span></td>
              <td><button className="btn btn-whatsapp btn-sm">WhatsApp</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TraineeHomeSimple({ onNav }) {
  return (
    <div className="workout-mobile">
      <div className="page-header">
        <div className="page-header-title">שלום מיה</div>
        <div className="page-header-sub">יאללה, ממשיכים להתחזק 💪</div>
      </div>

      <div className="card-burg mb-16">
        <div className="text-sm">היעד השבועי שלך</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>3/4 אימונים</div>
        <div className="mt-12">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '75%' }} />
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg mb-16"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => onNav('booking')}
      >
        קביעת אימון עם רוני
      </button>

      <div className="ex-card-mobile">
        <div className="stepper-num">האימון הבא</div>
        <div className="ex-name-big">Lower Body Strength</div>
        <div className="muted text-sm mb-12">4 תרגילים · 45 דקות</div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => onNav('do-workout')}
        >
          התחלת אימון
        </button>
      </div>

      <div className="card-sm">
        <div className="section-title">משוב מרוני</div>
        <div className="text-sm muted">
          עבודה מעולה באימון האחרון. אפשר להעלות מעט משקל בלחיצת כתף באימון הבא.
        </div>
      </div>
    </div>
  );
}

function BookingSimple({ onBack }) {
  const [type, setType] = useState('front');
  const [slot, setSlot] = useState('');
  const [proofName, setProofName] = useState('');

  const slots = [
    { id: 'sun-0900', label: 'ראשון · 09:00', location: 'Midtown', available: true },
    { id: 'sun-1730', label: 'ראשון · 17:30', location: 'בית הלקוח', available: true },
    { id: 'tue-0800', label: 'שלישי · 08:00', location: 'Zoom', available: true },
    { id: 'thu-1800', label: 'חמישי · 18:00', location: 'Midtown', available: false },
  ];

  return (
    <div className="workout-mobile">
      <div className="page-header">
        <div className="page-header-title">קביעת אימון</div>
        <div className="page-header-sub">בחרי סוג אימון, שעה ואסמכתת תשלום</div>
      </div>

      <div className="card mb-16">
        <div className="section-title">1. סוג אימון</div>
        <div className="grid-2">
          <button
            className={`filter-chip ${type === 'front' ? 'active' : ''}`}
            onClick={() => setType('front')}
          >
            פרונטלי
          </button>
          <button
            className={`filter-chip ${type === 'zoom' ? 'active' : ''}`}
            onClick={() => setType('zoom')}
          >
            Zoom
          </button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-title">2. חלונות זמינים השבוע</div>
        <div className="grid-2">
          {slots.map(item => (
            <button
              key={item.id}
              className={`time-slot ${slot === item.id ? 'sel' : ''} ${!item.available ? 'unavail' : ''}`}
              onClick={() => item.available && setSlot(item.id)}
            >
              <div>{item.label}</div>
              <div className="text-xs muted">{item.location}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-title">3. אסמכתת תשלום</div>
        <div className="text-sm muted mb-12">
          בשלב הזה זה דמו: מעלים שם קובץ כדי לדמות צילום מסך של העברה / PayBox / Bit.
        </div>
        <input
          className="form-input"
          placeholder="לדוגמה: paybox-maya.png"
          value={proofName}
          onChange={e => setProofName(e.target.value)}
        />
      </div>

      <div className="card-sm mb-16">
        <div className="section-title">סיכום בקשה</div>
        <div className="text-sm muted">
          הבקשה תישלח לרוני לאישור סופי. רק אחרי האישור האימון יופיע בלו״ז שלך ושלה.
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={!slot || !proofName}
      >
        שליחת בקשה לאישור רוני
      </button>

      <button className="btn btn-ghost mt-12" style={{ width: '100%', justifyContent: 'center' }} onClick={onBack}>
        חזרה לבית
      </button>
    </div>
  );
}

function DoWorkoutSimple({ onBack }) {
  const [sets, setSets] = useState([
    { id: 1, weight: '', reps: '', rir: '' },
    { id: 2, weight: '', reps: '', rir: '' },
    { id: 3, weight: '', reps: '', rir: '' },
  ]);

  function updateSet(id, field, value) {
    setSets(prev => prev.map(set => set.id === id ? { ...set, [field]: value } : set));
  }

  function calcRpe(rir) {
    if (rir === '') return '-';
    const value = Math.max(0, Math.min(4, Number(rir)));
    return 10 - value;
  }

  return (
    <div className="workout-mobile">
      <div className="page-header">
        <div className="page-header-title">תיעוד אימון</div>
        <div className="page-header-sub">ממלאים סטים מהר וברור, בלי אקסל</div>
      </div>

      <div className="alert-strip success">
        מאחלת לך אימון מוצלח! אחרי כל סט מלאי משקל, חזרות וכמה חזרות נשארו לך ברזרבה.
      </div>

      <div className="ex-card-mobile">
        <div className="stepper-num">תרגיל 1 מתוך 4</div>
        <div className="ex-name-big">לחיצת כתף</div>
        <div className="muted text-sm mb-12">3 סטים · 8–10 חזרות · מנוחה 90 שניות</div>

        {sets.map(set => (
          <div className="set-row" key={set.id}>
            <div className="set-num">{set.id}</div>
            <input
              className="set-input"
              placeholder="ק״ג"
              value={set.weight}
              onChange={e => updateSet(set.id, 'weight', e.target.value)}
            />
            <input
              className="set-input"
              placeholder="חזרות"
              value={set.reps}
              onChange={e => updateSet(set.id, 'reps', e.target.value)}
            />
            <select
              className="rir-select"
              value={set.rir}
              onChange={e => updateSet(set.id, 'rir', e.target.value)}
            >
              <option value="">RIR</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4+</option>
            </select>
            <div className="rpe-pill">RPE {calcRpe(set.rir)}</div>
          </div>
        ))}

        <div className="form-group mt-16">
          <label className="form-label">הערה לתרגיל</label>
          <textarea className="form-textarea" placeholder="איך הרגיש? כאב? טכניקה?" />
        </div>

        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
          העלאת סרטון ביצוע
        </button>
      </div>

      <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
        שליחת אימון לרוני
      </button>

      <button className="btn btn-ghost mt-12" style={{ width: '100%', justifyContent: 'center' }} onClick={onBack}>
        חזרה לבית
      </button>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState('he');
  const [role, setRole] = useState('admin');
  const [view, setView] = useState('today');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    document.body.className = lang === 'en' ? 'ltr' : '';
  }, [lang]);

  function onNav(nextView) {
    setView(nextView);
  }

  function switchRole(newRole) {
    setRole(newRole);
    setView(newRole === 'admin' ? 'today' : 'trainee-home');
  }

  const adminSections = [
    {
      label: 'מרכז פיקוד',
      links: [
        { view: 'today', icon: '✦', label: 'היום', badge: 3 },
        { view: 'dashboard', icon: '🏠', label: 'לוח בקרה' },
      ],
    },
    {
      label: 'ניהול',
      links: [
        { view: 'leads', icon: '📥', label: 'לידים' },
        { view: 'trainees', icon: '👥', label: 'מתאמנים' },
        { view: 'reviews', icon: '✍️', label: 'סקירת אימונים', badge: 3 },
        { view: 'programs', icon: '📋', label: 'תוכניות אימון' },
      ],
    },
    {
      label: 'פיננסי ולוח',
      links: [
        { view: 'schedule', icon: '📅', label: 'לוח זמנים' },
        { view: 'revenue', icon: '💰', label: 'הכנסות' },
      ],
    },
    {
      label: 'כללי',
      links: [
        { view: 'notifications', icon: '🔔', label: 'התראות', badge: 2 },
        { view: 'settings', icon: '⚙️', label: 'הגדרות' },
      ],
    },
  ];

  const traineeLinks = [
    { view: 'trainee-home', icon: '🏠', label: 'בית' },
    { view: 'booking', icon: '📅', label: 'קביעה' },
    { view: 'my-progress', icon: '📈', label: 'התקדמות' },
    { view: 'trainee-settings', icon: '⚙️', label: 'הגדרות' },
  ];

  function renderPage() {
    if (role === 'trainee') {
      if (view === 'trainee-home') return <TraineeHomeSimple onNav={onNav} />;
      if (view === 'booking') return <BookingSimple onBack={() => onNav('trainee-home')} />;
      if (view === 'do-workout') return <DoWorkoutSimple onBack={() => onNav('trainee-home')} />;
      if (view === 'my-progress') return <ProgressSimple />;
      if (view === 'notifications') return <Placeholder title="התראות" />;
      if (view === 'trainee-settings') return <Placeholder title="הגדרות" />;
      return <TraineeHomeSimple onNav={onNav} />;
    }

    switch (view) {
      case 'today':
        return <TodaySimple />;
      case 'leads':
        return <LeadsSimple />;
      case 'dashboard':
        return <Placeholder title="לוח בקרה" />;
      case 'trainees':
        return <Placeholder title="מתאמנים" />;
      case 'reviews':
        return <Placeholder title="סקירת אימונים" />;
      case 'programs':
        return <Placeholder title="תוכניות אימון" />;
      case 'schedule':
        return <Placeholder title="לוח זמנים" />;
      case 'revenue':
        return <Placeholder title="הכנסות" />;
      case 'notifications':
        return <Placeholder title="התראות" />;
      case 'settings':
        return <Placeholder title="הגדרות" />;
      default:
        return <TodaySimple />;
    }
  }

  return (
    <Layout
      role={role}
      view={view}
      lang={lang}
      setLang={setLang}
      switchRole={switchRole}
      notifCount={role === 'admin' ? 2 : 1}
      onNotif={() => onNav('notifications')}
      adminSections={adminSections}
      traineeLinks={traineeLinks}
      onNav={onNav}
    >
      {renderPage()}
    </Layout>
  );
}
