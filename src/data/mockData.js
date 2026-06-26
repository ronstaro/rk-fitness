// ─── COLORS (JS constants for inline styles) ──────────────────────
export const BURG = '#7C2D3E';
export const BURG_PALE = '#F9F0F2';
export const BURG_DARK = '#5A1E2B';
export const MUSTARD = '#C9972B';
export const MUSTARD_PALE = '#FDF3DC';
export const MUSTARD_D = '#A07820';
export const GRAY_50 = '#F7F6F3';
export const GRAY_100 = '#EDEBE6';
export const GRAY_200 = '#D8D5CE';
export const GRAY_400 = '#9E9A90';
export const GRAY_600 = '#615E57';
export const GRAY_900 = '#1E1C19';
export const SUCCESS = '#2D6A4F';
export const WARN = '#92400E';
export const DANGER = '#991B1B';
export const VAT_RATE = 0.18;
export const TAX_RATE = 0.057;

// ─── WHATSAPP HELPERS ──────────────────────────────────────────────
export function cleanPhone(p) {
  if (!p) return '';
  let n = p.replace(/[\s\-\(\)]/g, '');
  if (n.startsWith('0')) n = '972' + n.slice(1);
  return n;
}
export function openWA(phone, msg) {
  const n = cleanPhone(phone);
  if (!n) { alert('אין מספר טלפון'); return; }
  window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(msg), '_blank');
}

// ─── LOCALSTORAGE ──────────────────────────────────────────────────
export function ls(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
export function uid() { return 'id_' + Math.random().toString(36).slice(2, 9); }
export function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
export function isDigital(type) { return type === 'online' || type === 'hybrid'; }
export function consistencyColor(c) { return c >= 80 ? SUCCESS : c >= 60 ? WARN : DANGER; }
export function consistencyClass(c) { return c >= 80 ? 'green' : c >= 60 ? 'warn' : 'danger'; }

// ─── GENDER-AWARE TRAINING INFO MESSAGE ───────────────────────────
export function trainingInfoMsg(name, gender) {
  const base = `\n\nעל האימון:\n\n1. משך האימון כשעה. האימון הראשון הוא אימון יחסית קל, והמטרה שלנו היא לבדוק מאיפה ${gender === 'female' ? 'אנחנו מתחילות' : gender === 'male' ? 'אנחנו מתחילים' : 'מתחילים'} היום ולאן נרצה להגיע.\n2. ${gender === 'female' ? 'לבוא עם נעליים שטוחות כמו סניקרס — באימון כוח יש לזה השפעה גדולה על היציבה שלך. להביא גם מגבת, מים, והכי חשוב — להביא את עצמך בדיוק כמו שאת ❤️' : gender === 'male' ? 'לבוא עם נעליים שטוחות כמו סניקרס — באימון כוח יש לזה השפעה גדולה על היציבה שלך. להביא גם מגבת, מים, והכי חשוב — להביא את עצמך בדיוק כמו שאתה ❤️' : 'להגיע עם נעליים שטוחות כמו סניקרס — באימון כוח יש לזה השפעה גדולה על היציבה. להביא גם מגבת, מים, והכי חשוב — להגיע כמו שאת/ה ❤️'}\n\nפרטים אחרונים וחשובים לפני האימון:\n\n1. האם התאמנת בעבר? ואם כן, איך הייתה החוויה${gender === 'neutral' ? '' : ' שלך'}?\n2. האם יש ${gender === 'neutral' ? '' : 'לך '}פציעה או כאב מסוים? חשוב ${gender === 'neutral' ? 'לדעת' : 'לי לדעת'} מראש כדי להתאים ${gender === 'neutral' ? 'את האימון' : 'לך את האימון'} בצורה הכי טובה ❤️\n3. כשניפגש נדבר יחד על מטרות ומה חשוב ${gender === 'neutral' ? '' : 'לך '}מבחינת כוח, מוביליות וגמישות — ובהתאם גם למה ש${gender === 'neutral' ? 'נראה' : 'אראה'} באימון 🙏🏻\n4. אשמח ש${gender === 'female' ? 'תמלאי' : gender === 'male' ? 'תמלא' : 'תמלאו'} הצהרת בריאות בקישור המצורף כדי שאוכל לבטח אותך במהלך האימון:\n   https://tpz.link/wvsgq\n5. מחירי האימונים מחושבים לפי כמות שבועית:\n   אימון חד-שבועי — 300₪\n   אימון דו-שבועי — 250₪ לכל אימון\n   ניתן לשלם במזומן, פייבוקס או העברה בנקאית ברכישת כרטיסייה מראש.`;
  return `היי ${name}, איזה כיף שקבענו אימון ❤️` + base;
}

// ─── WA TEMPLATES ──────────────────────────────────────────────────
export const WA_TEMPLATES = [
  { id: 'ending',    label: 'תוכנית מסתיימת',  text: (n) => `היי ${n}, התוכנית שלך מסתיימת בעוד שבוע — רוצה שנחדש ונמשיך? 💪` },
  { id: 'checkin',   label: 'בדיקה כללית',      text: (n) => `היי ${n}, רק רציתי לבדוק איך הולך השבוע 😊` },
  { id: 'lead',      label: 'מעקב ליד',         text: (n) => `היי ${n}, זאת רוני 😊 דיברנו לגבי אימונים — רוצה שנתאם שיחה?` },
  { id: 'missed',    label: 'אימונים שהוחמצו',  text: (n) => `היי ${n}, ראיתי שהשבוע קצת התפספסו אימונים. הכול בסדר? רוצה שנחזור למסלול?` },
  { id: 'payment',   label: 'תשלום פתוח',       text: (n) => `היי ${n}, רק תזכורת קטנה לגבי התשלום הפתוח. תודה 😊` },
  { id: 'birthday',  label: 'יום הולדת',        text: (n) => `היי ${n}, יום הולדת שמח! 🎂💪 שנה חזקה ומלאה התקדמות!` },
  { id: 'anniversary', label: 'שנה של אימונים', text: (n) => `${n}, עברה שנה שלמה! מטורף לראות את הדרך שעשית. גאה בך 💪` },
  { id: 'renewal',   label: 'חידוש מנוי',       text: (n) => `היי ${n}, המנוי החודשי מסתיים בקרוב — מחכה לאישור תשלום לחידוש 😊` },
  { id: 'healthDecl',label: 'הצהרת בריאות',     text: (n) => `היי ${n}, כדי שנוכל להתחיל בצורה מסודרת ובטוחה, מצרפת הצהרת בריאות למילוי: https://tpz.link/wvsgq\nאחרי המילוי נמשיך לשאלון קצר ונצא לדרך 💪` },
  { id: 'pkgRenew',  label: 'חידוש כרטיסייה',   text: (n) => `היי ${n}, נשאר לך עוד אימון אחד בכרטיסייה. רוצה לחדש כדי שנמשיך בלי עצירות? 💪` },
];

// ─── FEEDBACK TEMPLATES ────────────────────────────────────────────
export const FEEDBACK_TEMPLATES = [
  { cat: 'חיובי 👍',       items: ['מעולה, טכניקה טובה מאוד. אפשר להמשיך ככה.', 'אחלה עבודה היום, רואים שיפור בשליטה ובביצוע.', 'יפה מאוד, זה נראה הרבה יותר יציב מהפעם הקודמת.'] },
  { cat: 'העלה משקל ⬆',    items: ['אפשר להעלות מעט משקל באימון הבא.', 'נראה שהמשקל כבר נוח, ננסה לעלות בהדרגה.'] },
  { cat: 'שמור על משקל =', items: ['נשמור על אותו משקל עוד שבוע לחיזוק טכניקה.', 'לא הייתי מעלה משקל עדיין. קודם נייצב את הביצוע.'] },
  { cat: 'הורד משקל ⬇',    items: ['כדאי להוריד מעט משקל לשמור על טכניקה נקייה.', 'המשקל נראה מעט כבד — עדיף לעבוד מדויק לפני שמעלים.'] },
  { cat: 'מנוחה ▸',         items: ['תנוחי בערך 90 שניות בין הסטים.', 'שימי לב לא למהר בין הסטים — איכות הביצוע חשובה יותר.'] },
  { cat: 'מוטיבציה 💪',     items: ['מעולה, להמשיך ככה. את בכיוון מצוין 💪', 'גם אם היה קשה — עצם זה שהשלמת אותו זה ניצחון.'] },
];

// ─── RISK SCORING ──────────────────────────────────────────────────
export function calcRisk(tr, sessions) {
  let score = 0; const reasons = [];
  const c = tr.weeklyGoal > 0 ? Math.round(tr.completedThisWeek / tr.weeklyGoal * 100) : 100;
  if (c < 100) { score += 25; reasons.push('לא עמד ביעד השבועי'); }
  const last = tr.lastWorkout ? new Date(tr.lastWorkout) : null;
  const days = last ? Math.floor((new Date() - last) / 86400000) : 99;
  if (days >= 10) { score += 25; reasons.push('לא הגיש אימון כבר ' + days + ' ימים'); }
  const pe = tr.programEnd ? Math.ceil((new Date(tr.programEnd) - new Date()) / 86400000) : 99;
  if (pe >= 0 && pe <= 7) { score += 15; reasons.push('תוכנית מסתיימת בעוד ' + pe + ' ימים'); }
  if (tr.paymentStatus === 'unpaid') { score += 20; reasons.push('תשלום פתוח לא שולם'); }
  const hasSess = (sessions || []).some(s => s.traineeId === tr.id && new Date(s.date) >= new Date());
  if (!hasSess && tr.type !== 'online') { score += 15; reasons.push('אין שיעור מתוכנן'); }
  if (tr.consistency < 60) { score += 20; reasons.push('עקביות נמוכה'); }
  const level = score <= 30 ? 'low' : score <= 60 ? 'med' : 'high';
  const label = level === 'low' ? 'סיכון נמוך' : level === 'med' ? 'סיכון בינוני' : 'סיכון גבוה';
  const cls   = level === 'low' ? 'risk-low'  : level === 'med' ? 'risk-med'    : 'risk-high';
  return { score, level, label, cls, reasons };
}

// ─── PROGRAM STATUS ────────────────────────────────────────────────
export function programStatus(p) {
  if (!p.startDate || !p.endDate) return 'draft';
  const now = new Date(), s = new Date(p.startDate), e = new Date(p.endDate);
  if (now < s) return 'draft';
  const d = Math.ceil((e - now) / 86400000);
  if (d < 0) return 'completed'; if (d <= 7) return 'ending'; return 'active';
}
export function programStatusLabel(st) {
  return { draft: 'טיוטה', active: 'פעיל', ending: 'מסתיים בקרוב', completed: 'הסתיים' }[st] || st;
}
export function programStatusCls(st) {
  return { draft: 'status-draft', active: 'status-active', ending: 'status-ending', completed: 'status-completed' }[st] || 'status-draft';
}

// ─── MOCK DATA ─────────────────────────────────────────────────────
export const initLeads = [
  { id: 'l1', name: 'נועה לוי',      phone: '054-1234567', email: 'noa@email.com',     age: 28, goal: 'ירידה במשקל',    level: 'מתחיל',  serviceType: 'online',   location: 'תל אביב', availability: 'ערב',   notes: 'הפנייה מחברה', source: 'friend',    gender: 'female',  status: 'new',                    followUpDate: '', healthDeclDone: false },
  { id: 'l2', name: 'עמיחי בן-דוד', phone: '052-9876543', email: 'ami@email.com',     age: 34, goal: 'בניית מאסה',     level: 'בינוני', serviceType: 'inPerson', location: 'גבעתיים', availability: 'בוקר',  notes: 'כאבי גב',     source: 'instagram', gender: 'male',    status: 'followUp',              followUpDate: '2026-06-25', healthDeclDone: false },
  { id: 'l3', name: 'שירה כהן',      phone: '050-4445555', email: 'shira@email.com',   age: 22, goal: 'חיזוק ועיצוב',  level: 'מתחיל',  serviceType: 'hybrid',   location: 'רמת גן',  availability: 'גמיש',  notes: '',             source: 'facebook',  gender: 'female',  status: 'consultationScheduled', followUpDate: '', healthDeclDone: false },
  { id: 'l4', name: 'ידידיה מרקוס',  phone: '053-7771234', email: 'yedidya@email.com', age: 41, goal: 'כושר כללי',     level: 'מתקדם', serviceType: 'inPerson', location: 'תל אביב', availability: 'אחה"צ', notes: 'רץ מרתון',    source: 'other',     gender: 'male',    status: 'new',                    followUpDate: '', healthDeclDone: false },
];

export const MOCK_TRAINEES = [
  { id: 't1', name: 'מיה גולדברג', phone: '054-2233445', email: 'maya@email.com',  age: 30, birthday: '1996-03-15', trainingStart: '2024-06-01', status: 'active', type: 'online',    goal: 'עיצוב גוף וחיזוק',    injuries: 'ללא',       package: 'מנוי מקוון חודשי', packagePrice: 650,  paymentStatus: 'paid',   paymentMethod: 'bit',          nextPayment: '2026-07-01', monthlyValue: 650,  programId: 'p1', programStart: '2026-04-01', programEnd: '2026-07-01', notes: 'מתקדמת מצוין.',     weeklyGoal: 4, completedThisWeek: 4, lastWorkout: '2026-06-20', consistency: 92, avatar: 'מ' },
  { id: 't2', name: 'אור שמיר',    phone: '052-8899001', email: 'or@email.com',    age: 26, birthday: '2000-11-22', trainingStart: '2025-02-10', status: 'active', type: 'hybrid',    goal: 'בניית מאסה שרירית',   injuries: 'כאב כתף קל', package: 'מנוי מקוון חודשי', packagePrice: 650,  paymentStatus: 'paid',   paymentMethod: 'bankTransfer', nextPayment: '2026-07-05', monthlyValue: 650,  programId: 'p2', programStart: '2026-05-01', programEnd: '2026-07-31', notes: 'שים לב לטכניקה בכתף.', weeklyGoal: 4, completedThisWeek: 3, lastWorkout: '2026-06-19', consistency: 78, avatar: 'א' },
  { id: 't3', name: 'רותם אשר',    phone: '050-3344556', email: 'rotem@email.com', age: 35, birthday: '1991-07-04', trainingStart: '2023-07-04', status: 'active', type: 'inPerson',  goal: 'ירידה במשקל וחיטוב',  injuries: 'ברך ימין',   package: '8 שיעורים',          packagePrice: 1200, paymentStatus: 'unpaid', paymentMethod: 'cash',         nextPayment: '2026-06-25', monthlyValue: 1200, programId: 'p3', programStart: '2026-05-15', programEnd: '2026-06-25', notes: 'נמנעת מקפיצות.',    weeklyGoal: 2, completedThisWeek: 2, lastWorkout: '2026-06-20', consistency: 85, avatar: 'ר' },
  { id: 't4', name: 'תמר פרידמן',  phone: '053-6677889', email: 'tamar@email.com', age: 38, birthday: '1988-12-30', trainingStart: '2025-06-10', status: 'active', type: 'online',    goal: 'כושר כללי ואיזון',    injuries: 'ללא',       package: 'חבילה מקוונת',       packagePrice: 900,  paymentStatus: 'paid',   paymentMethod: 'paybox',       nextPayment: '2026-07-10', monthlyValue: 900,  programId: 'p4', programStart: '2026-03-01', programEnd: '2026-06-24', notes: 'עובדת בשיפטים.',     weeklyGoal: 3, completedThisWeek: 1, lastWorkout: '2026-06-10', consistency: 55, avatar: 'ת' },
];

export const initPackages = [
  { id: 'pkg1', traineeId: 't3', packageName: '8 שיעורים פרונטליים', totalSessions: 8,  usedSessions: 5, pricePerSession: 150, totalPrice: 1200, paymentStatus: 'unpaid', paymentMethod: 'cash',         receiptIssued: false, startDate: '2026-05-15', expirationDate: '2026-08-15', notes: '' },
  { id: 'pkg2', traineeId: 't2', packageName: '10 שיעורים פרטניים', totalSessions: 10, usedSessions: 4, pricePerSession: 140, totalPrice: 1400, paymentStatus: 'paid',   paymentMethod: 'bankTransfer', receiptIssued: true,  startDate: '2026-04-01', expirationDate: '2026-09-01', notes: '' },
];

export const initPrograms = [
  { id: 'p1', name: 'תוכנית עיצוב — מיה', traineeId: 't1', goal: 'עיצוב וחיזוק',        startDate: '2026-04-01', endDate: '2026-07-01', weeks: 12, frequency: 4, notes: '', isTemplate: false, templateName: '', workouts: [
    { id: 'w1', name: 'אימון A — פלג עליון',   warmup: '5 דקות הליכון, עיגול כתפיים 10x',  notes: '', supersets: [], exercises: [
      { id: 'e1', name: 'לחיצת חזה בשכיבה', muscle: 'חזה',    sets: 4, reps: 10, targetWeight: 35,   prevWeight: 32.5, rest: 90,  trainerNote: 'שמרי על סיבוב כלפי חוץ בכתפיים', demo: '', supersetId: '' },
      { id: 'e2', name: 'מסלול פרפר',       muscle: 'חזה',    sets: 3, reps: 12, targetWeight: 12,   prevWeight: 10,   rest: 60,  trainerNote: '', demo: '', supersetId: '' },
      { id: 'e3', name: 'פרונטל מוט',        muscle: 'כתפיים', sets: 4, reps: 8,  targetWeight: 25,   prevWeight: 22.5, rest: 90,  trainerNote: 'מרפקים לא נועלים למעלה', demo: '', supersetId: '' },
    ]},
    { id: 'w2', name: 'אימון B — פלג תחתון', warmup: '10 דקות אופניים, מתיחות ירך', notes: '', supersets: [], exercises: [
      { id: 'e4', name: 'סקוואט בר',          muscle: 'רגליים', sets: 4, reps: 8,  targetWeight: 60,   prevWeight: 55,   rest: 120, trainerNote: 'גב ישר, ברכיים לא פנימה', demo: '', supersetId: '' },
      { id: 'e5', name: "לאנג' עם משקולות",   muscle: 'רגליים', sets: 3, reps: 12, targetWeight: 14,   prevWeight: 12,   rest: 60,  trainerNote: '', demo: '', supersetId: '' },
    ]},
  ]},
  { id: 'p2', name: 'תוכנית מאסה — אור',  traineeId: 't2', goal: 'בנייה מאסה שרירית',  startDate: '2026-05-01', endDate: '2026-07-31', weeks: 12, frequency: 4, notes: '', isTemplate: false, templateName: '', workouts: [
    { id: 'w3', name: 'אימון חזה + טריצפס', warmup: '5 דקות חימום + מתיחות כתפיים', notes: '', supersets: [{ id: 'ss1', name: 'סופר סט — חזה', type: 'superset', rounds: 3, notes: '' }], exercises: [
      { id: 'e7', name: 'לחיצת חזה עם מוט', muscle: 'חזה', sets: 5, reps: 6,  targetWeight: 80, prevWeight: 75, rest: 120, trainerNote: 'ירידה מלאה לחזה', demo: '', supersetId: 'ss1' },
      { id: 'e8', name: 'פול-אובר',          muscle: 'גב',  sets: 3, reps: 12, targetWeight: 22, prevWeight: 20, rest: 60,  trainerNote: '', demo: '', supersetId: 'ss1' },
      { id: 'e9', name: 'פרפר מכונה',        muscle: 'חזה', sets: 3, reps: 15, targetWeight: 40, prevWeight: 35, rest: 45,  trainerNote: '', demo: '', supersetId: '' },
    ]},
  ]},
  { id: 'p3', name: 'שיעורים — רותם',     traineeId: 't3', goal: 'ירידה במשקל',         startDate: '2026-05-15', endDate: '2026-06-25', weeks: 6,  frequency: 2, notes: '', isTemplate: false, templateName: '', workouts: [] },
  { id: 'p4', name: 'תוכנית איזון — תמר', traineeId: 't4', goal: 'כושר כללי',           startDate: '2026-03-01', endDate: '2026-06-24', weeks: 14, frequency: 3, notes: '', isTemplate: false, templateName: '', workouts: [] },
  { id: 'tpl1', name: 'תוכנית מתחילים 3 ימים', traineeId: '', goal: 'כושר כללי', startDate: '', endDate: '', weeks: 8, frequency: 3, notes: '', isTemplate: true, templateName: 'תוכנית מתחילים 3 ימים', workouts: [
    { id: 'tw1', name: 'אימון כל הגוף', warmup: '5 דקות הליכה', notes: '', supersets: [], exercises: [
      { id: 'te1', name: 'סקוואט עם משקל גוף', muscle: 'רגליים', sets: 3, reps: 15, targetWeight: 0, prevWeight: 0, rest: 60, trainerNote: 'גב ישר', demo: '', supersetId: '' },
      { id: 'te2', name: 'שכיבות שמיכה',        muscle: 'חזה',    sets: 3, reps: 10, targetWeight: 0, prevWeight: 0, rest: 60, trainerNote: '', demo: '', supersetId: '' },
    ]},
  ]},
];

export const initSubmitted = [
  { id: 'sw1', traineeId: 't1', traineeName: 'מיה גולדברג', workoutId: 'w1', workoutName: 'אימון A — פלג עליון', date: '2026-06-20', status: 'pending_review',
    summary: { howWas: 'מצוין', energy: 8, fatigue: 6, pain: 'ללא', notes: 'הרגשתי חזקה!', completed: true },
    exercises: [
      { id: 'e1', name: 'לחיצת חזה בשכיבה', sets: [{ weight: 35, reps: 10, rir: '1' }, { weight: 35, reps: 10, rir: '1' }, { weight: 35, reps: 9, rir: '2' }, { weight: 32.5, reps: 10, rir: '2' }], note: 'הרגיש טוב' },
      { id: 'e2', name: 'מסלול פרפר',        sets: [{ weight: 12, reps: 12, rir: '2' }, { weight: 12, reps: 12, rir: '2' }, { weight: 10, reps: 12, rir: '3' }], note: '' },
      { id: 'e3', name: 'פרונטל מוט',         sets: [{ weight: 25, reps: 8, rir: '0' }, { weight: 25, reps: 8, rir: '0' }, { weight: 22.5, reps: 8, rir: '1' }, { weight: 22.5, reps: 7, rir: '1' }], note: 'סוף קשה' },
    ], feedback: null },
  { id: 'sw2', traineeId: 't2', traineeName: 'אור שמיר', workoutId: 'w3', workoutName: 'אימון חזה + טריצפס', date: '2026-06-19', status: 'reviewed',
    summary: { howWas: 'טוב', energy: 7, fatigue: 7, pain: 'כאב קל בכתף', notes: '', completed: true },
    exercises: [
      { id: 'e7', name: 'לחיצת חזה עם מוט', sets: [{ weight: 80, reps: 6, rir: '1' }, { weight: 80, reps: 6, rir: '1' }, { weight: 77.5, reps: 6, rir: '2' }, { weight: 77.5, reps: 6, rir: '2' }, { weight: 75, reps: 6, rir: '2' }], note: '' },
      { id: 'e8', name: 'פול-אובר',          sets: [{ weight: 22, reps: 12, rir: '3' }, { weight: 22, reps: 12, rir: '3' }, { weight: 20, reps: 12, rir: '3' }], note: '' },
    ], feedback: { general: 'אימון מצוין! שיפור יפה.', exercises: [{ id: 'e7', note: 'טכניקה טובה.', rec: 'increase' }, { id: 'e8', note: 'שמור על אותו משקל.', rec: 'maintain' }] } },
];

export const MOCK_SESSIONS = [
  { id: 's1', traineeId: 't3', traineeName: 'רותם אשר', date: '2026-06-25', time: '09:00', endTime: '10:00', duration: 60, sessionType: 'inPerson', location: 'home',    locationName: 'בית הלקוחה',      address: 'רחוב ויצמן 22, תל אביב',   bufferMinutes: 15, travelTimeMinutes: null, travelMode: null,      packageId: 'pkg1', sessionNumber: 6, completed: false, notes: '', blocked: false },
  { id: 's2', traineeId: 't2', traineeName: 'אור שמיר', date: '2026-06-26', time: '11:00', endTime: '12:00', duration: 60, sessionType: 'inPerson', location: 'studio',  locationName: 'סטודיו תל אביב',   address: 'רחוב דיזנגוף 100',          bufferMinutes: 10, travelTimeMinutes: null, travelMode: null,      packageId: 'pkg2', sessionNumber: 5, completed: false, notes: '', blocked: false },
  { id: 's3', traineeId: 't3', traineeName: 'רותם אשר', date: '2026-06-27', time: '10:00', endTime: '11:00', duration: 60, sessionType: 'inPerson', location: 'home',    locationName: 'פארק ירקון',        address: 'גן לאומי ירקון, תל אביב',  bufferMinutes: 20, travelTimeMinutes: null, travelMode: 'driving', packageId: 'pkg1', sessionNumber: 7, completed: false, notes: '', blocked: false },
  { id: 's4', traineeId: '',   traineeName: '',          date: '2026-06-26', time: '14:00', endTime: '15:30', duration: 90, sessionType: 'personal',  location: 'personal', locationName: 'חסום — יומן אישי', address: '',                          bufferMinutes: 0,  travelTimeMinutes: null, travelMode: null,      packageId: '',     sessionNumber: null, completed: false, notes: '', blocked: true  },
];

export const initBookingRequests = [
  { id: 'br1', traineeId: 't1', traineeName: 'מיה גולדברג', type: 'zoom', date: '2026-06-28', time: '10:00', duration: 60, paymentProofRef: 'proof_img_1', packageId: null, status: 'pending', requestedAt: '2026-06-21', notes: '' },
];

export const RONI_AVAILABILITY = [
  { date: '2026-06-28', slots: ['08:00', '09:00', '10:00', '16:00', '17:00'] },
  { date: '2026-06-29', slots: ['08:00', '10:00', '11:00', '15:00'] },
  { date: '2026-06-30', slots: ['09:00', '12:00', '16:00', '17:00'] },
  { date: '2026-07-01', slots: ['08:00', '09:00', '10:00', '11:00'] },
  { date: '2026-07-02', slots: ['09:00', '10:00', '14:00', '15:00', '16:00'] },
];

export const initNotifs = [
  { id: 'n1', type: 'review',   text: 'מיה גולדברג שלחה אימון לסקירה',                    time: 'לפני שעה',      date: '2026-06-21', read: false, urgent: false },
  { id: 'n2', type: 'lead',     text: 'ליד חדש: ידידיה מרקוס',                             time: 'לפני 3 שעות',   date: '2026-06-21', read: false, urgent: false },
  { id: 'n3', type: 'program',  text: 'תוכנית תמר פרידמן מסתיימת בעוד 2 ימים',             time: 'אתמול',         date: '2026-06-20', read: false, urgent: true  },
  { id: 'n4', type: 'followup', text: 'מעקב עם עמיחי בן-דוד — היום',                       time: 'היום',          date: '2026-06-21', read: false, urgent: true  },
  { id: 'n5', type: 'birthday', text: 'יום הולדת לרותם אשר ב-4 ביולי',                     time: 'לפני 3 ימים',   date: '2026-06-18', read: true,  urgent: false },
  { id: 'n6', type: 'pkgAlert', text: 'רותם אשר — נותר שיעור אחד בכרטיסייה',               time: 'לפני יום',      date: '2026-06-20', read: false, urgent: true  },
  { id: 'n7', type: 'booking',  text: 'מיה גולדברג ביקשה לקבוע אימון Zoom ב-28/6',         time: 'לפני 3 שעות',   date: '2026-06-21', read: false, urgent: false },
];

export const initTraineeNotifs = [
  { id: 'tn1', type: 'feedback', text: 'קיבלת משוב חדש מרוני! 💬',                        time: 'לפני 30 דקות', read: false },
  { id: 'tn2', type: 'reminder', text: 'היי, מחר ב-09:00 יש לנו אימון. מחכה לך 💪',        time: 'אתמול 21:00',  read: false },
  { id: 'tn3', type: 'session',  text: 'שיעור פרונטלי מחר ב-09:00 📅',                     time: 'אתמול',        read: true  },
  { id: 'tn4', type: 'renewal',  text: 'המנוי החודשי מסתיים בעוד 3 ימים — נא לחדש 💳',     time: 'לפני 2 שעות',  read: false },
];

export const STRETCH_MUSCLES = {
  front: [
    { id: 'chest',      name: 'חזה / Pectorals',        icon: '🫀', x: 210, y: 140, w: 80, h: 50, side: 'front', instructions: "עמדי בפתח דלת, יד על המשקוף, סובבי גוף החוצה לאט. החזיקי 20-30 שנ'.", videos: ['https://youtube.com/watch?v=chest-stretch'] },
    { id: 'shoulders',  name: 'כתפיים / Deltoids',      icon: '🦾', x: 150, y: 130, w: 55, h: 45, side: 'front', instructions: "הביאי יד מעל ראש, כופי מרפק, לחצי בעדינות. החזיקי 20 שנ' לכל צד.", videos: ['https://youtube.com/watch?v=shoulder-stretch'] },
    { id: 'biceps',     name: 'ביצפס',                  icon: '💪', x: 160, y: 185, w: 40, h: 50, side: 'front', instructions: 'פרשי זרוע ישר לצד, אגודל כלפי מטה, הטי ראש הצידה ההפוכה.', videos: ['https://youtube.com/watch?v=biceps-stretch'] },
    { id: 'abs',        name: 'בטן / Abs',              icon: '🧘', x: 200, y: 200, w: 70, h: 70, side: 'front', instructions: "שכבי בטן, הרמי גוף עליון על ידיים, כמו קוברה ביוגה. החזיקי 20 שנ'.", videos: ['https://youtube.com/watch?v=abs-stretch'] },
    { id: 'hipflexors', name: 'כופפי ירך / Hip Flexors',icon: '🦯', x: 195, y: 290, w: 80, h: 50, side: 'front', instructions: "כריעה על ברך אחת, דחפי אגן קדימה בעדינות. 20-30 שנ' לכל צד.", videos: ['https://youtube.com/watch?v=hipflexor-stretch'] },
    { id: 'quads',      name: 'ירך קדמי / Quads',       icon: '🦵', x: 185, y: 360, w: 50, h: 80, side: 'front', instructions: "עמדי, משכי קרסול לישבן, שמרי ברכיים צמודות. 20 שנ' לכל רגל.", videos: ['https://youtube.com/watch?v=quad-stretch'] },
    { id: 'calves_f',   name: 'שוק / Calves',           icon: '🦶', x: 195, y: 460, w: 45, h: 50, side: 'front', instructions: "עמדי מול קיר, רגל אחת מאחור ישרה, דחפי עקב לרצפה. 20 שנ' לכל רגל.", videos: ['https://youtube.com/watch?v=calf-stretch'] },
  ],
  back: [
    { id: 'trapezius',  name: 'טרפז / Trapezius',       icon: '🏋️', x: 210, y: 115, w: 80, h: 40, side: 'back', instructions: "הטי ראש לכיוון אחד בעדינות, החזיקי 15-20 שנ', חזרי על הצד השני.", videos: ['https://youtube.com/watch?v=trap-stretch'] },
    { id: 'upperback',  name: 'גב עליון / Upper Back',  icon: '🔙', x: 200, y: 155, w: 80, h: 50, side: 'back', instructions: 'שלבי אצבעות לפנייך, דחפי כפות ידיים קדימה והעגלי גב עליון.', videos: ['https://youtube.com/watch?v=upperback-stretch'] },
    { id: 'lats',       name: 'לאטיסימוס / Lats',       icon: '🦅', x: 180, y: 185, w: 110, h: 60, side: 'back', instructions: 'אחזי בסף דלת, הישארי עם ידיים ישרות, שקעי לאחור בעדינות.', videos: ['https://youtube.com/watch?v=lats-stretch'] },
    { id: 'lowerback',  name: 'גב תחתון / Lower Back',  icon: '🧨', x: 200, y: 255, w: 70, h: 40, side: 'back', instructions: "שכבי על הגב, הביאי ברכיים לחזה, החזיקי בעדינות. 30 שנ'.", videos: ['https://youtube.com/watch?v=lowerback-stretch'] },
    { id: 'glutes',     name: 'ישבן / Glutes',          icon: '🍑', x: 190, y: 300, w: 90, h: 55, side: 'back', instructions: 'שכבי על הגב, הצלבי רגל מעל הברך השנייה, משכי לחזה.', videos: ['https://youtube.com/watch?v=glutes-stretch'] },
    { id: 'hamstrings', name: 'ירך אחורי / Hamstrings', icon: '🦵', x: 195, y: 370, w: 80, h: 75, side: 'back', instructions: "הניחי רגל על משטח גבוה, התכופפי קדימה בעדינות. 20 שנ'.", videos: ['https://youtube.com/watch?v=hamstring-stretch'] },
  ],
};