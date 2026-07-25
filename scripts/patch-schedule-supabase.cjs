const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "src", "AppFullMigration.jsx");
let content = fs.readFileSync(filePath, "utf8");
const hasBom = content.charCodeAt(0) === 0xfeff;
if (hasBom) content = content.slice(1);
content = content.replace(/\r\n/g, "\n");

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) return count;
    count += 1;
    index = found + needle.length;
  }
}

function replaceOnce(oldText, newText, label) {
  const count = countOccurrences(content, oldText);
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  }
  content = content.replace(oldText, newText);
}

function assertCount(text, expected, label) {
  const count = countOccurrences(content, text);
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected}, found ${count}`);
  }
}

const sessionsImport = 'import { fetchSessions, createSession, updateSessionStatus, deleteSession } from "./services/sessionsService.js";';
const traineesImport = 'import { fetchTrainees, createTrainee, updateTrainee, updateTraineeStatus, deleteTrainee } from "./services/traineesService.js";';
const importCount = countOccurrences(content, sessionsImport);
if (importCount === 0) {
  replaceOnce(traineesImport, `${traineesImport}\n${sessionsImport}`, "insert sessionsService import");
} else if (importCount > 1) {
  throw new Error(`Duplicate sessionsService import found: ${importCount}`);
}

const oldScheduleTop = `function Schedule() {
  const SCHED_KEY = "rk-fitness-schedule";
  const TRAIN_KEY = "rk-fitness-trainees";

  function loadSessions() {
    try {
      const raw = localStorage.getItem(SCHED_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function loadTrainees() {
    try {
      const raw = localStorage.getItem(TRAIN_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  const [sessions, setSessions] = useState(loadSessions);
  const [trainees] = useState(loadTrainees);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    traineeId: "",
    traineeName: "",
    date: "",
    startTime: "",
    durationMinutes: "",
    trainingType: "אישי",
    location: "",
    status: "מתוכנן",
    notes: "",
  });

  useEffect(() => {
    localStorage.setItem(SCHED_KEY, JSON.stringify(sessions));
  }, [sessions]);`;

const newScheduleTop = `function Schedule() {
  const [sessions, setSessions] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    traineeId: "",
    traineeName: "",
    date: "",
    startTime: "",
    durationMinutes: "",
    trainingType: "אישי",
    location: "",
    status: "מתוכנן",
    notes: "",
  });

  function mapSessionRow(row, traineesList) {
    const trainee = traineesList.find((t) => t.id === row.trainee_id);
    return {
      id: row.id,
      traineeId: row.trainee_id,
      traineeName: trainee ? trainee.full_name : "מתאמן לא ידוע",
      date: row.session_date,
      startTime: row.start_time ? row.start_time.slice(0, 5) : "",
      durationMinutes: row.duration_minutes,
      trainingType: row.training_type,
      location: row.location,
      status: row.status,
      notes: row.notes ?? "",
      createdAt: row.created_at,
    };
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [sessionRows, traineeRows] = await Promise.all([fetchSessions(), fetchTrainees()]);
        if (active) {
          setTrainees(traineeRows);
          setSessions(sessionRows.map((row) => mapSessionRow(row, traineeRows)));
        }
      } catch (err) {
        console.error("Schedule fetch error:", err);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);`;

replaceOnce(oldScheduleTop, newScheduleTop, "replace Schedule localStorage top block");

replaceOnce(
  `  function handleTraineeSelect(traineeId) {
    const t = trainees.find((tr) => tr.id === traineeId);
    setForm((f) => ({ ...f, traineeId, traineeName: t ? t.fullName : "" }));
  }`,
  `  function handleTraineeSelect(traineeId) {
    const t = trainees.find((tr) => tr.id === traineeId);
    setForm((f) => ({ ...f, traineeId, traineeName: t ? t.full_name : "" }));
  }`,
  "update handleTraineeSelect full_name"
);

const oldHandleSave = `  function handleSave() {
    const traineeId = form.traineeId;
    const date = form.date.trim();
    const startTime = form.startTime.trim();
    const dur = Number(form.durationMinutes);
    const location = form.location.trim();
    if (!traineeId || !date || !startTime || !form.durationMinutes || !location) {
      setFormError("מתאמן, תאריך, שעת התחלה, משך ומיקום הם שדות חובה");
      return;
    }
    if (dur <= 0) {
      setFormError("משך האימון חייב להיות גדול מ-0");
      return;
    }
    if (hasOverlap(date, startTime, dur, sessions)) {
      setFormError("קיים אימון חופף בשעה שנבחרה");
      return;
    }
    const session = {
      id: Date.now().toString(),
      traineeId,
      traineeName: form.traineeName,
      date,
      startTime,
      durationMinutes: dur,
      trainingType: form.trainingType,
      location,
      status: form.status,
      notes: form.notes.trim(),
      createdAt: new Date().toLocaleDateString("he-IL"),
    };
    setSessions((prev) => [...prev, session]);
    setForm({ traineeId: "", traineeName: "", date: "", startTime: "", durationMinutes: "", trainingType: "אישי", location: "", status: "מתוכנן", notes: "" });
    setFormError("");
    setShowForm(false);
  }`;

const newHandleSave = `  async function handleSave() {
    const traineeId = form.traineeId;
    const date = form.date.trim();
    const startTime = form.startTime.trim();
    const dur = Number(form.durationMinutes);
    const location = form.location.trim();
    if (!traineeId || !date || !startTime || !form.durationMinutes || !location) {
      setFormError("מתאמן, תאריך, שעת התחלה, משך ומיקום הם שדות חובה");
      return;
    }
    if (dur <= 0) {
      setFormError("משך האימון חייב להיות גדול מ-0");
      return;
    }
    if (hasOverlap(date, startTime, dur, sessions)) {
      setFormError("קיים אימון חופף בשעה שנבחרה");
      return;
    }

    try {
      const row = await createSession({
        traineeId,
        date,
        startTime,
        durationMinutes: dur,
        trainingType: form.trainingType,
        location,
        status: form.status,
        notes: form.notes.trim(),
      });
      setSessions((prev) => [...prev, mapSessionRow(row, trainees)]);
      setForm({ traineeId: "", traineeName: "", date: "", startTime: "", durationMinutes: "", trainingType: "אישי", location: "", status: "מתוכנן", notes: "" });
      setFormError("");
      setShowForm(false);
    } catch (err) {
      console.error("Session create error:", err);
      setFormError("לא ניתן לשמור את האימון. נסה שוב.");
    }
  }`;

replaceOnce(oldHandleSave, newHandleSave, "replace handleSave");

replaceOnce(
  `  function handleStatusChange(id, newStatus) {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: newStatus } : s));
  }`,
  `  async function handleStatusChange(id, newStatus) {
    try {
      const row = await updateSessionStatus(id, newStatus);
      setSessions((prev) => prev.map((s) => s.id === id ? mapSessionRow(row, trainees) : s));
    } catch (err) {
      console.error("Session status update error:", err);
    }
  }`,
  "replace handleStatusChange"
);

replaceOnce(
  `  function handleDelete(id) {
    if (window.confirm("למחוק אימון זה?")) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  }`,
  `  async function handleDelete(id) {
    if (!window.confirm("למחוק אימון זה?")) {
      return;
    }

    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Session delete error:", err);
    }
  }`,
  "replace handleDelete"
);

replaceOnce(
  `{trainees.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}`,
  `{trainees.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}`,
  "update trainee select option full_name"
);

assertCount("useState(loadSessions)", 0, "old sessions localStorage state removed");
assertCount("useState(loadTrainees)", 0, "old trainees localStorage state removed");
assertCount("localStorage.setItem(SCHED_KEY", 0, "old Schedule localStorage writer removed");
assertCount("loadSessions()", 0, "old loadSessions removed");
assertCount("loadTrainees()", 0, "old loadTrainees removed");
assertCount("const [sessions, setSessions] = useState([]);", 1, "sessions state declaration");
assertCount("const [trainees, setTrainees] = useState([]);", 1, "trainees state declaration");
assertCount("function mapSessionRow(row, traineesList)", 1, "mapSessionRow declaration");
assertCount("async function handleSave()", 1, "async handleSave declaration");
assertCount("async function handleStatusChange", 1, "async handleStatusChange declaration");
assertCount("async function handleDelete", 1, "async handleDelete declaration");
assertCount("t.fullName", 0, "legacy fullName removed from Schedule picker/select");
assertCount("t.full_name", 2, "Supabase full_name usages in Schedule");
assertCount(sessionsImport, 1, "sessionsService import count");

const output = (hasBom ? "\ufeff" : "") + content.replace(/\n/g, "\r\n");
fs.writeFileSync(filePath, output, "utf8");
console.log("Schedule Supabase patch applied successfully.");
