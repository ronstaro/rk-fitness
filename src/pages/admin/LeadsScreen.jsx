import { useState, useEffect } from 'react';
import {
  BURG, BURG_PALE, BURG_DARK, GRAY_50, GRAY_100, WARN,
  ls, lsSet, uid, openWA, trainingInfoMsg,
  WA_TEMPLATES,
  initLeads,
} from '../../data/mockData.js';
import PageHeader from '../../components/PageHeader.jsx';

// ── WAModal ────────────────────────────────────────────────────────────
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
          <button className="btn btn-whatsapp" onClick={() => { openWA(person.phone || '', msg); onClose(); }}>פתח WhatsApp</button>
          <button className="btn btn-outline" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ── constants ──────────────────────────────────────────────────────────
const STATUSES = ['new', 'contacted', 'followUp', 'consultationScheduled', 'converted', 'notRelevant'];
const STATUS_HE = {
  new: 'חדש', contacted: 'נוצר קשר', followUp: 'מעקב',
  consultationScheduled: 'שיחה נקבעה', converted: 'הפך למתאמן', notRelevant: 'לא רלוונטי',
};
const STATUS_BADGE = {
  new: 'badge-new', contacted: 'badge-warn', followUp: 'badge-mustard',
  consultationScheduled: 'badge-burg', converted: 'badge-active', notRelevant: 'badge-inactive',
};
const SRC_LABEL = { friend: '👥 המלצה', instagram: '📸 אינסטגרם', facebook: '👍 פייסבוק', other: '🔗 אחר' };
const GENDER_LABEL = { female: 'נקבה', male: 'זכר', neutral: 'לא מצוין' };

const BLANK = () => ({
  id: '', name: '', gender: 'neutral', phone: '', email: '',
  age: '', goal: '', level: 'מתחיל', serviceType: 'inPerson',
  location: '', availability: '', notes: '', source: 'friend',
  status: 'new', followUpDate: '', healthDeclDone: false,
});

// ── LeadDetail ─────────────────────────────────────────────────────────
function LeadDetail({ lead, onChange, onBack, onConvert }) {
  const [waTarget, setWaTarget] = useState(null);

  const set = (field, val) => onChange(lead.id, field, val);

  return (
    <div className="slide-in">
      {waTarget && <WAModal person={waTarget} onClose={() => setWaTarget(null)} />}

      <div className="flex-gap mb-24">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← חזרה</button>
        <div className="page-header-title" style={{ margin: 0, fontSize: 20 }}>{lead.name}</div>
      </div>

      <div className="grid-2">
        {/* left col — info + actions */}
        <div>
          <div className="card mb-16">
            <div className="section-title">פרטי ליד</div>
            {[
              ['שם',     lead.name],
              ['מגדר',   GENDER_LABEL[lead.gender] || '—'],
              ['טלפון',  lead.phone],
              ['אימייל', lead.email],
              ['גיל',    lead.age],
              ['מטרה',   lead.goal],
              ['שירות',  lead.serviceType],
              ['מיקום',  lead.location],
              ['מקור',   SRC_LABEL[lead.source] || lead.source],
            ].map(([k, v]) => (
              <div key={k} className="flex-between"
                style={{ padding: '8px 0', borderBottom: `0.5px solid ${GRAY_100}`, fontSize: 14 }}>
                <span className="muted">{k}</span>
                <span style={{ fontWeight: 500 }}>{v || '—'}</span>
              </div>
            ))}
            {lead.notes && (
              <div className="mt-12 text-sm"
                style={{ background: GRAY_50, padding: 10, borderRadius: 8, lineHeight: 1.6 }}>
                {lead.notes}
              </div>
            )}
          </div>

          {/* send training info */}
          <div className="card mb-16">
            <div className="section-title">שליחת פרטים על האימון</div>
            <p className="text-sm muted mb-12" style={{ lineHeight: 1.6 }}>
              הודעת WhatsApp מותאמת לפי מגדר — כוללת פרטי האימון, מחירים והצהרת בריאות.
            </p>
            <button
              className="btn btn-whatsapp"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                if (!lead.phone) { alert('אין מספר טלפון'); return; }
                openWA(lead.phone, trainingInfoMsg(lead.name, lead.gender || 'neutral'));
              }}
            >
              📤 שלח פרטים על האימון
            </button>
          </div>

          {/* health declaration */}
          <div className="card mb-16">
            <div className="section-title">הצהרת בריאות</div>
            <label
              className={`health-decl-strip mb-12${lead.healthDeclDone ? '' : ' alert-strip warn'}`}
              style={lead.healthDeclDone
                ? {}
                : { background: '#FEF3C7', border: '1px solid #F59E0B', color: WARN }}
            >
              <input
                type="checkbox"
                checked={!!lead.healthDeclDone}
                onChange={e => set('healthDeclDone', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>{lead.healthDeclDone ? '✅ הצהרת בריאות הושלמה' : '⏳ ממתין להצהרת בריאות'}</span>
            </label>
            <div className="flex-gap flex-wrap mb-16">
              <button className="btn btn-outline btn-sm"
                onClick={() => window.open('https://tpz.link/wvsgq', '_blank')}>
                🔗 פתח טופס
              </button>
              <button className="btn btn-whatsapp btn-sm"
                onClick={() => setWaTarget({ ...lead, _tpl: 'healthDecl' })}>
                שלח WA עם קישור
              </button>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', opacity: lead.healthDeclDone ? 1 : 0.5, cursor: lead.healthDeclDone ? 'pointer' : 'not-allowed' }}
              onClick={() => {
                if (!lead.healthDeclDone) { alert('יש להשלים הצהרת בריאות לפני ההמרה'); return; }
                onConvert(lead.id);
              }}
            >
              המרה למתאמן {lead.healthDeclDone ? '' : '🔒'}
            </button>
          </div>
        </div>

        {/* right col — status */}
        <div>
          <div className="card mb-16">
            <div className="section-title">שינוי סטטוס</div>
            {STATUSES.map(s => (
              <button
                key={s}
                className="btn btn-outline btn-sm"
                style={{
                  marginBottom: 8, width: '100%', justifyContent: 'flex-start',
                  background: lead.status === s ? BURG_PALE : '',
                  color:      lead.status === s ? BURG      : '',
                }}
                onClick={() => set('status', s)}
              >
                {lead.status === s && '✓ '}{STATUS_HE[s]}
              </button>
            ))}
            {lead.status === 'followUp' && (
              <div className="form-group mt-16">
                <label className="form-label">תאריך מעקב</label>
                <input
                  type="date"
                  className="form-input"
                  value={lead.followUpDate || ''}
                  onChange={e => set('followUpDate', e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">פעולות מהירות</div>
            <button className="btn btn-whatsapp btn-sm" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setWaTarget(lead)}>
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NewLeadForm ────────────────────────────────────────────────────────
function NewLeadForm({ onSave, onCancel }) {
  const [form, setForm] = useState(BLANK());
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div className="slide-in">
      <div className="flex-gap mb-24">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>← חזרה</button>
        <div className="page-header-title" style={{ margin: 0, fontSize: 20 }}>ליד חדש</div>
      </div>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">שם מלא *</label>
            <input className="form-input" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="שם מלא" />
          </div>
          <div className="form-group">
            <label className="form-label">מגדר</label>
            <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="female">נקבה</option>
              <option value="male">זכר</option>
              <option value="neutral">לא מצוין</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">טלפון</label>
            <input className="form-input" value={form.phone}
              onChange={e => set('phone', e.target.value)} placeholder="05X-XXXXXXX" />
          </div>
          <div className="form-group">
            <label className="form-label">אימייל</label>
            <input className="form-input" value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="email@..." />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">גיל</label>
            <input type="number" className="form-input" value={form.age}
              onChange={e => set('age', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">מקור</label>
            <select className="form-select" value={form.source} onChange={e => set('source', e.target.value)}>
              <option value="friend">👥 המלצה</option>
              <option value="instagram">📸 אינסטגרם</option>
              <option value="facebook">👍 פייסבוק</option>
              <option value="other">🔗 אחר</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">סוג שירות</label>
            <select className="form-select" value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
              <option value="inPerson">פרונטלי</option>
              <option value="zoom">Zoom</option>
              <option value="online">ליווי מקוון</option>
              <option value="hybrid">היברידי</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">סטטוס</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_HE[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">מטרה</label>
            <input className="form-input" value={form.goal}
              onChange={e => set('goal', e.target.value)} placeholder="ירידה במשקל, בניית מאסה..." />
          </div>
          <div className="form-group">
            <label className="form-label">תאריך מעקב</label>
            <input type="date" className="form-input" value={form.followUpDate}
              onChange={e => set('followUpDate', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">הערות</label>
          <textarea className="form-textarea" value={form.notes}
            onChange={e => set('notes', e.target.value)} placeholder="הערות נוספות..." />
        </div>

        <div className="flex-gap mt-8">
          <button className="btn btn-primary"
            onClick={() => { if (!form.name) { alert('יש להזין שם'); return; } onSave({ ...form, id: uid() }); }}>
            שמור ליד ✓
          </button>
          <button className="btn btn-outline" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ── main LeadsScreen ───────────────────────────────────────────────────
export default function LeadsScreen({ onNav }) {
  const [leads, setLeads]         = useState(() => ls('rk_leads', initLeads));
  const [selected, setSelected]   = useState(null);   // lead id
  const [showForm, setShowForm]   = useState(false);
  const [filter, setFilter]       = useState('all');
  const [waTarget, setWaTarget]   = useState(null);

  useEffect(() => lsSet('rk_leads', leads), [leads]);

  function changeLead(id, field, val) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
    if (selected === id) {
      /* detail view re-renders via leads list lookup — no extra state needed */
    }
  }
  function convertLead(id) {
    changeLead(id, 'status', 'converted');
    alert('הליד הומר למתאמן/ת בהצלחה!');
    setSelected(null);
  }

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter);
  const sel = leads.find(l => l.id === selected);

  // ── new lead form
  if (showForm) {
    return (
      <NewLeadForm
        onSave={l => { setLeads(prev => [l, ...prev]); setShowForm(false); setSelected(l.id); }}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  // ── lead detail
  if (sel) {
    return (
      <LeadDetail
        lead={sel}
        onChange={changeLead}
        onBack={() => setSelected(null)}
        onConvert={convertLead}
      />
    );
  }

  // ── list view
  return (
    <div className="slide-in">
      {waTarget && <WAModal person={waTarget} onClose={() => setWaTarget(null)} />}

      <PageHeader
        title="לידים"
        sub={`${leads.length} לידים במערכת`}
        action={
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            + הוסף ליד
          </button>
        }
      />

      {/* filter chips */}
      <div className="filter-chips">
        <span
          className={`filter-chip${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {`הכל (${leads.length})`}
        </span>
        {STATUSES.map(s => (
          <span
            key={s}
            className={`filter-chip${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {`${STATUS_HE[s]} (${leads.filter(l => l.status === s).length})`}
          </span>
        ))}
      </div>

      {/* table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>שם</th>
              <th>מגדר</th>
              <th>טלפון</th>
              <th>מקור</th>
              <th>הצהרה</th>
              <th>סטטוס</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id}>
                <td style={{ cursor: 'pointer' }} onClick={() => setSelected(l.id)}>
                  <div className="flex-gap">
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{l.name[0]}</div>
                    <span style={{ fontWeight: 500 }}>{l.name}</span>
                  </div>
                </td>
                <td className="text-xs muted">{GENDER_LABEL[l.gender] || '—'}</td>
                <td className="text-sm muted">{l.phone}</td>
                <td><span className="text-xs muted">{SRC_LABEL[l.source] || l.source}</span></td>
                <td>
                  {l.healthDeclDone
                    ? <span className="badge badge-active" style={{ fontSize: 11 }}>✅ הושלם</span>
                    : <span className="badge badge-warn"   style={{ fontSize: 11 }}>ממתין</span>}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[l.status] || 'badge-inactive'}`}>
                    {STATUS_HE[l.status] || l.status}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-whatsapp" onClick={() => setWaTarget(l)}>WA</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div>אין לידים בקטגוריה זו</div>
          </div>
        )}
      </div>
    </div>
  );
}