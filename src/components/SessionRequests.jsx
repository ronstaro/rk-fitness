import { useEffect, useRef, useState } from "react";
import { fetchTraineeProfile } from "../services/traineeHomeService.js";
import {
  PROOF_ACCEPT,
  REQUEST_STATUS_LABELS,
  approveSessionRequest,
  cancelMySessionRequest,
  createMySessionRequest,
  fetchMySessionRequests,
  fetchPendingSessionRequests,
  fetchSessionRequestHistory,
  getPaymentProofUrl,
  rejectSessionRequest,
  sessionRequestErrorMessage,
  validatePaymentProof,
} from "../services/sessionRequestsService.js";
import { PAYMENT_METHODS, localDateKey, paymentMethodLabel } from "../lib/payments.js";

const MAX_DAYS_AHEAD = 60;
const MAX_PENDING = 3;
const LOCATION_PRESETS = ["סטודיו", "בית המתאמן"];
const STATUS_BADGES = {
  pending: "badge-warn",
  approved: "badge-active",
  rejected: "badge-danger",
  cancelled: "badge-inactive",
};

function addDaysKey(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function formatRequestDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(value) {
  return value ? value.slice(0, 5) : "";
}

// "2026-11-15" → "15.11.2026", without going through a time zone.
function formatDateKey(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

// A moment (created_at / decided_at) shown in Israel time: "12.11.2026 · 18:42".
const ISRAEL_MOMENT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatMoment(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(ISRAEL_MOMENT.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}.${parts.month}.${parts.year} · ${parts.hour}:${parts.minute}`;
}

function RequestStatus({ status }) {
  return (
    <span className={`badge ${STATUS_BADGES[status] || "badge-inactive"}`}>
      {REQUEST_STATUS_LABELS[status] || status}
    </span>
  );
}

// The proof is private: a signed link is asked for only when it is shown.
function PaymentProof({ path }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getPaymentProofUrl(path)
      .then((signedUrl) => active && setUrl(signedUrl))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [path]);

  if (failed) return <div className="session-request-proof empty">לא ניתן להציג את האישור</div>;
  if (!url) return <div className="session-request-proof empty">טוען אישור...</div>;
  return (
    <a className="session-request-proof" href={url} target="_blank" rel="noreferrer" title="פתיחת אישור התשלום">
      <img src={url} alt="אישור תשלום" />
    </a>
  );
}

// ── Trainee ─────────────────────────────────────────────────────────────

function emptyRequestForm() {
  return { date: "", startTime: "", note: "" };
}

export function TraineeSessionRequests() {
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState(emptyRequestForm);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [listError, setListError] = useState("");
  const fileInputRef = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const traineeProfile = await fetchTraineeProfile();
        const rows = traineeProfile ? await fetchMySessionRequests(traineeProfile.id) : [];
        if (!active) return;
        setProfile(traineeProfile);
        setRequests(rows);
      } catch (error) {
        console.warn("Session requests fetch failed:", error?.name);
        if (active) setLoadError("לא ניתן לטעון את בקשות האימון כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
    setSentMessage("");
  }

  function handleFile(event) {
    const picked = event.target.files?.[0] ?? null;
    setFormError("");
    setSentMessage("");
    if (!picked) return;
    try {
      validatePaymentProof(picked);
    } catch (error) {
      setFormError(sessionRequestErrorMessage(error, "לא ניתן לצרף את הקובץ."));
      event.target.value = "";
      return;
    }
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function clearFile() {
    setFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const minDate = localDateKey();
  const maxDate = addDaysKey(MAX_DAYS_AHEAD);

  async function handleSubmit(event) {
    event.preventDefault();
    if (lockRef.current || sending) return;

    if (!form.date || !form.startTime) {
      setFormError("יש לבחור תאריך ושעה.");
      return;
    }
    if (!file) {
      setFormError("יש לצרף צילום של אישור התשלום.");
      return;
    }
    if (new Date(`${form.date}T${form.startTime}`) <= new Date()) {
      setFormError("אפשר לבקש רק מועד עתידי.");
      return;
    }
    if (form.date > maxDate) {
      setFormError("אפשר לבקש אימון עד 60 יום קדימה.");
      return;
    }
    if (pendingCount >= MAX_PENDING) {
      setFormError("יש כבר 3 בקשות שממתינות לאישור. אפשר לבטל אחת או לחכות לתשובה.");
      return;
    }

    lockRef.current = true;
    setSending(true);
    setFormError("");
    try {
      await createMySessionRequest({
        traineeId: profile.id,
        date: form.date,
        startTime: form.startTime,
        note: form.note,
        file,
      });
      setRequests(await fetchMySessionRequests(profile.id));
      setForm(emptyRequestForm());
      clearFile();
      setSentMessage("הבקשה נשלחה לרוני. האימון יופיע ביומן אחרי שתאשר אותו.");
    } catch (error) {
      console.warn("Session request create failed:", error?.code || error?.name);
      setFormError(sessionRequestErrorMessage(error, "לא ניתן לשלוח את הבקשה כרגע. נסו שוב."));
    } finally {
      lockRef.current = false;
      setSending(false);
    }
  }

  async function handleCancel(request) {
    if (lockRef.current || sending) return;
    if (!window.confirm("לבטל את הבקשה?")) return;

    lockRef.current = true;
    setCancellingId(request.id);
    setListError("");
    try {
      await cancelMySessionRequest(request.id);
      setRequests(await fetchMySessionRequests(profile.id));
    } catch (error) {
      console.warn("Session request cancel failed:", error?.code || error?.name);
      setListError(sessionRequestErrorMessage(error, "לא ניתן לבטל את הבקשה כרגע."));
    } finally {
      lockRef.current = false;
      setCancellingId(null);
    }
  }

  if (loading) {
    return <div className="trainee-home-state">טוען את בקשות האימון...</div>;
  }

  if (loadError) {
    return (
      <div className="trainee-home-state">
        <p>{loadError}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
          נסה שוב
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="trainee-home-state">
        <strong>החשבון עדיין לא שויך למתאמן</strong>
        <p>יש לפנות למאמנת כדי להשלים את החיבור לחשבון.</p>
      </div>
    );
  }

  // Matches the server rule (027): in-person and online trainees.
  const eligible = profile.training_type === "אישי" || profile.training_type === "אונליין";
  const limitReached = pendingCount >= MAX_PENDING;

  return (
    <div className="session-requests-page">
      <section className="card session-request-card">
        <div className="section-title">📅 בקשה לאימון אישי</div>
        {!eligible ? (
          <p className="session-request-info">
            בקשת אימון זמינה כרגע למתאמנים באימון אישי או אונליין. לתיאום אפשר לפנות ישירות לרוני.
          </p>
        ) : (
          <form className="session-request-form" onSubmit={handleSubmit} noValidate>
            <p className="session-request-info">
              בוחרים מועד, מצרפים צילום של אישור התשלום ושולחים. האימון ייקבע ביומן רק לאחר אישור רוני.
            </p>

            <div className="session-request-when">
              <label className="form-group">
                <span className="form-label">תאריך *</span>
                <input
                  className="form-input"
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={form.date}
                  onChange={(event) => handleField("date", event.target.value)}
                  disabled={sending}
                />
              </label>
              <label className="form-group">
                <span className="form-label">שעה *</span>
                <input
                  className="form-input"
                  type="time"
                  step="900"
                  value={form.startTime}
                  onChange={(event) => handleField("startTime", event.target.value)}
                  disabled={sending}
                />
              </label>
            </div>

            <div className="form-group">
              <span className="form-label">אישור תשלום *</span>
              {file ? (
                <div className="session-request-file">
                  {previewUrl && <img src={previewUrl} alt="תצוגה מקדימה של אישור התשלום" />}
                  <div>
                    <strong>{file.name}</strong>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearFile} disabled={sending}>
                      החלפת תמונה
                    </button>
                  </div>
                </div>
              ) : (
                <label className="session-request-upload">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PROOF_ACCEPT}
                    onChange={handleFile}
                    disabled={sending}
                  />
                  <span>📎 צירוף צילום מסך של ההעברה · תמונה עד 10MB</span>
                </label>
              )}
            </div>

            <label className="form-group">
              <span className="form-label">הערה לרוני</span>
              <textarea
                className="form-textarea"
                rows="2"
                maxLength={500}
                value={form.note}
                onChange={(event) => handleField("note", event.target.value)}
                placeholder="לא חובה"
                disabled={sending}
              />
            </label>

            {form.date && form.startTime && (
              <div className="session-request-summary">
                <strong>{formatRequestDate(form.date)} · {form.startTime}</strong>
                <span>האימון ייקבע ביומן רק לאחר אישור רוני.</span>
              </div>
            )}

            {limitReached && (
              <div className="session-request-note">
                יש 3 בקשות שממתינות לאישור. אפשר לשלוח בקשה חדשה אחרי שתתקבל תשובה או אחרי ביטול.
              </div>
            )}
            {formError && <div className="schedule-form-error">{formError}</div>}
            {sentMessage && <div className="session-request-sent">{sentMessage}</div>}

            <button type="submit" className="btn btn-primary" disabled={sending || limitReached}>
              {sending ? "שולח..." : "שליחת בקשה"}
            </button>
          </form>
        )}
      </section>

      <section className="card session-request-card">
        <div className="section-title">הבקשות שלי</div>
        {listError && <div className="schedule-form-error">{listError}</div>}
        {requests.length === 0 ? (
          <div className="trainee-home-empty">עדיין לא נשלחו בקשות</div>
        ) : (
          <div className="session-request-list">
            {requests.map((request) => (
              <article className="session-request-row" key={request.id}>
                <div>
                  <strong>{formatRequestDate(request.requested_date)} · {formatTime(request.requested_start_time)}</strong>
                  {request.trainee_note && <small>ההערה שלך: {request.trainee_note}</small>}
                  {request.decision_note && <small>מרוני: {request.decision_note}</small>}
                </div>
                <div className="session-request-row-side">
                  <RequestStatus status={request.status} />
                  {request.status === "pending" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleCancel(request)}
                      disabled={cancellingId !== null || sending}
                    >
                      {cancellingId === request.id ? "מבטל..." : "ביטול"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Admin (inside the schedule) ─────────────────────────────────────────

function approvalForm(trainee) {
  return {
    location: "סטודיו",
    durationMinutes: "60",
    recordPayment: true,
    amount: trainee?.package_price == null ? "" : String(trainee.package_price),
    paymentMethod: PAYMENT_METHODS.includes(paymentMethodLabel(trainee?.payment_method))
      ? paymentMethodLabel(trainee.payment_method)
      : "",
    paidAt: localDateKey(),
    decisionNote: "",
  };
}

const HISTORY_FILTERS = [
  { id: "all", label: "הכל" },
  { id: "approved", label: "אושרו" },
  { id: "rejected", label: "נדחו" },
];

const DECISION_LABELS = {
  approved: "אושרה",
  rejected: "נדחתה",
  cancelled: "בוטלה ע״י המתאמן",
};

const HISTORY_EMPTY = {
  all: "עדיין אין בקשות שטופלו.",
  approved: "אין בקשות שאושרו.",
  rejected: "אין בקשות שנדחו.",
};

// Where the approved session sits on the calendar now. Approval always creates
// a session, so an approved request without one means it was deleted later.
function CalendarLine({ request }) {
  const session = request.scheduled_session;
  if (!session) {
    return <span className="session-request-history-line warn">האימון הוסר מהיומן</span>;
  }
  const moved = session.session_date !== request.requested_date
    || formatTime(session.start_time) !== formatTime(request.requested_start_time);
  return (
    <span className="session-request-history-line">
      <b>ביומן:</b>{" "}
      <bdi>{formatDateKey(session.session_date)} · {formatTime(session.start_time)}</bdi>
      {moved && <span className="session-request-tag">הוזז</span>}
      {session.status && session.status !== "מתוכנן" && (
        <span className={`session-request-tag ${session.status === "בוטל" ? "warn" : ""}`}>{session.status}</span>
      )}
    </span>
  );
}

function HistoryCard({ request, name }) {
  const [showProof, setShowProof] = useState(false);
  const decided = DECISION_LABELS[request.status] || REQUEST_STATUS_LABELS[request.status] || request.status;

  return (
    <article className="session-request-history-card" data-status={request.status}>
      <div className="session-request-history-head">
        <strong>{name}</strong>
        <RequestStatus status={request.status} />
      </div>
      <span className="session-request-history-line">
        <b>מועד מבוקש:</b>{" "}
        <bdi>{formatDateKey(request.requested_date)} · {formatTime(request.requested_start_time)}</bdi>
      </span>
      {request.status === "approved" && <CalendarLine request={request} />}
      <span className="session-request-history-line">
        <b>{decided}:</b> <bdi>{formatMoment(request.decided_at)}</bdi>
      </span>
      {request.decision_note && (
        <span className="session-request-history-note">{request.decision_note}</span>
      )}
      <div className="session-request-history-meta">
        <small>
          נשלחה: <bdi>{formatMoment(request.created_at)}</bdi>
          {request.status === "approved" && (request.payment_id ? " · תשלום נרשם" : " · לא נרשם תשלום")}
        </small>
        <button
          type="button"
          className="session-request-proof-toggle"
          aria-expanded={showProof}
          onClick={() => setShowProof((value) => !value)}
        >
          {showProof ? "הסתרת אישור התשלום" : "אישור התשלום"}
        </button>
      </div>
      {request.trainee_note && <small className="session-request-history-sub">“{request.trainee_note}”</small>}
      {showProof && <PaymentProof path={request.payment_proof_path} />}
    </article>
  );
}

export function SessionRequestsPanel({ trainees, hasConflict, onScheduled, onDecided }) {
  const [pending, setPending] = useState({ rows: [], loading: true, error: "" });
  const [history, setHistory] = useState({ rows: [], hasMore: false, loading: true, loadingMore: false, error: "", moreError: "" });
  const [filter, setFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [working, setWorking] = useState(false);
  const lockRef = useRef(false);
  // Only the latest history request may write to state (fast filter changes).
  const historyTokenRef = useRef(0);

  useEffect(() => {
    let active = true;
    setPending((current) => ({ ...current, loading: true, error: "" }));
    fetchPendingSessionRequests()
      .then((rows) => active && setPending({ rows, loading: false, error: "" }))
      .catch((error) => {
        console.error("Pending session requests fetch error:", error);
        if (active) setPending((current) => ({ ...current, loading: false, error: "לא ניתן לטעון את הבקשות הממתינות." }));
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    const token = ++historyTokenRef.current;
    setHistory((current) => ({ ...current, loading: true, error: "", moreError: "" }));
    fetchSessionRequestHistory({ filter, offset: 0 })
      .then(({ rows, hasMore }) => {
        if (historyTokenRef.current !== token) return;
        setHistory({ rows, hasMore, loading: false, loadingMore: false, error: "", moreError: "" });
      })
      .catch((error) => {
        console.error("Session request history fetch error:", error);
        if (historyTokenRef.current !== token) return;
        setHistory((current) => ({ ...current, rows: [], hasMore: false, loading: false, error: "לא ניתן לטעון את ההיסטוריה." }));
      });
  }, [filter, reloadKey]);

  async function loadMore() {
    if (history.loading || history.loadingMore || !history.hasMore) return;
    const token = historyTokenRef.current;
    setHistory((current) => ({ ...current, loadingMore: true, moreError: "" }));
    try {
      const { rows, hasMore } = await fetchSessionRequestHistory({ filter, offset: history.rows.length });
      if (historyTokenRef.current !== token) return;
      setHistory((current) => {
        const seen = new Set(current.rows.map((row) => row.id));
        return {
          ...current,
          rows: [...current.rows, ...rows.filter((row) => !seen.has(row.id))],
          hasMore,
          loadingMore: false,
        };
      });
    } catch (error) {
      console.error("Session request history load-more error:", error);
      if (historyTokenRef.current !== token) return;
      setHistory((current) => ({ ...current, loadingMore: false, moreError: "לא ניתן לטעון עוד. נסו שוב." }));
    }
  }

  function traineeFor(request) {
    return trainees.find((trainee) => trainee.id === request.trainee_id);
  }

  function traineeName(request) {
    return traineeFor(request)?.full_name || "מתאמן לא ידוע";
  }

  function openApprove(request) {
    if (working) return;
    setDialog({ kind: "approve", request });
    setForm(approvalForm(traineeFor(request)));
    setDialogError("");
  }

  function openReject(request) {
    if (working) return;
    setDialog({ kind: "reject", request });
    setForm({ decisionNote: "" });
    setDialogError("");
  }

  function closeDialog() {
    if (working) return;
    setDialog(null);
    setForm(null);
    setDialogError("");
  }

  function handleField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setDialogError("");
  }

  async function finishDecision(scheduled) {
    setDialog(null);
    setForm(null);
    // Both lists reload: the request leaves "pending" and opens the history.
    setReloadKey((key) => key + 1);
    onDecided?.();
    if (scheduled) await onScheduled?.();
  }

  async function handleApprove(event) {
    event.preventDefault();
    if (lockRef.current || working) return;
    const { request } = dialog;
    const duration = Number(form.durationMinutes);
    const location = form.location.trim();
    const amount = Number(form.amount);

    if (!location) {
      setDialogError("יש למלא מיקום.");
      return;
    }
    if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
      setDialogError("משך האימון צריך להיות בין 15 ל-240 דקות.");
      return;
    }
    if (form.recordPayment) {
      if (form.amount === "" || !Number.isFinite(amount) || amount < 0) {
        setDialogError("יש למלא סכום תקין.");
        return;
      }
      if (!form.paymentMethod) {
        setDialogError("יש לבחור אמצעי תשלום.");
        return;
      }
      if (!form.paidAt || form.paidAt > localDateKey()) {
        setDialogError("תאריך התשלום לא יכול להיות עתידי.");
        return;
      }
    }
    if (hasConflict?.(request.requested_date, formatTime(request.requested_start_time), duration)) {
      setDialogError("יש כבר אימון ביומן שחופף לשעה הזו. אפשר לדחות את הבקשה או לפנות קודם את היומן.");
      return;
    }

    lockRef.current = true;
    setWorking(true);
    setDialogError("");
    try {
      await approveSessionRequest(request.id, {
        location,
        durationMinutes: duration,
        recordPayment: form.recordPayment,
        amount,
        paymentMethod: form.paymentMethod,
        paidAt: form.paidAt,
        decisionNote: form.decisionNote,
      });
      await finishDecision(true);
    } catch (error) {
      console.error("Session request approve error:", error);
      setDialogError(sessionRequestErrorMessage(error, "לא ניתן לאשר את הבקשה. נסו שוב."));
    } finally {
      lockRef.current = false;
      setWorking(false);
    }
  }

  async function handleReject(event) {
    event.preventDefault();
    if (lockRef.current || working) return;
    lockRef.current = true;
    setWorking(true);
    setDialogError("");
    try {
      await rejectSessionRequest(dialog.request.id, form.decisionNote);
      await finishDecision(false);
    } catch (error) {
      console.error("Session request reject error:", error);
      setDialogError(sessionRequestErrorMessage(error, "לא ניתן לדחות את הבקשה. נסו שוב."));
    } finally {
      lockRef.current = false;
      setWorking(false);
    }
  }

  return (
    <section className="schedule-list-section session-requests-panel">
      <div className="schedule-section-title">
        <div>
          <h3>ממתינות</h3>
          <p>
            {pending.loading
              ? "טוען..."
              : pending.error
                ? ""
                : pending.rows.length === 0
                ? "אין בקשות שממתינות לאישור"
                : `${pending.rows.length} בקשות ממתינות לאישור`}
          </p>
        </div>
      </div>

      {pending.error && (
        <div className="schedule-error-strip">
          {pending.error}{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
            נסה שוב
          </button>
        </div>
      )}

      {pending.rows.length > 0 && (
        <div className="session-request-admin-list">
          {pending.rows.map((request) => (
            <article className="card session-request-admin" key={request.id}>
              <PaymentProof path={request.payment_proof_path} />
              <div className="session-request-admin-body">
                <strong>{traineeName(request)}</strong>
                <span>{formatRequestDate(request.requested_date)} · {formatTime(request.requested_start_time)}</span>
                <small>נשלחה: <bdi>{formatMoment(request.created_at)}</bdi></small>
                {request.trainee_note && <small>“{request.trainee_note}”</small>}
                <div className="session-request-admin-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => openApprove(request)} disabled={working}>
                    אישור וקביעה ביומן
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => openReject(request)} disabled={working}>
                    דחייה
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="schedule-section-title session-request-history-title">
        <div>
          <h3>היסטוריה</h3>
          <p>בקשות שטופלו, מהחדשה לישנה</p>
        </div>
      </div>
      <div className="filter-chips session-request-history-filters" role="group" aria-label="סינון היסטוריה">
        {HISTORY_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`filter-chip ${filter === option.id ? "active" : ""}`}
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {history.loading ? (
        <div className="session-request-history-empty">טוען היסטוריה...</div>
      ) : history.error ? (
        <div className="schedule-error-strip">
          {history.error}{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
            נסה שוב
          </button>
        </div>
      ) : history.rows.length === 0 ? (
        <div className="session-request-history-empty">{HISTORY_EMPTY[filter]}</div>
      ) : (
        <>
          <div className="session-request-history-list">
            {history.rows.map((request) => (
              <HistoryCard key={request.id} request={request} name={traineeName(request)} />
            ))}
          </div>
          {history.moreError && <div className="schedule-error-strip">{history.moreError}</div>}
          {history.hasMore && (
            <div className="session-request-history-more">
              <button type="button" className="btn btn-outline btn-sm" onClick={loadMore} disabled={history.loadingMore}>
                {history.loadingMore ? "טוען..." : "טען עוד"}
              </button>
            </div>
          )}
        </>
      )}

      {dialog && form && (
        <div className="modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <form
            className="modal session-request-dialog"
            onSubmit={dialog.kind === "approve" ? handleApprove : handleReject}
          >
            <h3 className="modal-title">
              {dialog.kind === "approve" ? "אישור בקשת אימון" : "דחיית בקשת אימון"}
            </h3>
            <p className="session-request-dialog-sub">
              {traineeName(dialog.request)} · {formatRequestDate(dialog.request.requested_date)} · {formatTime(dialog.request.requested_start_time)}
            </p>

            {dialog.kind === "approve" ? (
              <div className="schedule-form-grid">
                <label className="form-group schedule-form-wide">
                  <span className="form-label">מיקום *</span>
                  <input
                    className="form-input"
                    list="session-request-locations"
                    value={form.location}
                    onChange={(event) => handleField("location", event.target.value)}
                    disabled={working}
                  />
                  <datalist id="session-request-locations">
                    {LOCATION_PRESETS.map((location) => (
                      <option value={location} key={location} />
                    ))}
                  </datalist>
                </label>
                <label className="form-group">
                  <span className="form-label">משך בדקות *</span>
                  <input
                    className="form-input"
                    type="number"
                    min="15"
                    max="240"
                    step="5"
                    value={form.durationMinutes}
                    onChange={(event) => handleField("durationMinutes", event.target.value)}
                    disabled={working}
                  />
                </label>

                <label className="session-request-check schedule-form-wide">
                  <input
                    type="checkbox"
                    checked={form.recordPayment}
                    onChange={(event) => handleField("recordPayment", event.target.checked)}
                    disabled={working}
                  />
                  <span>לרשום תשלום (יופיע בכספים כ"שולם")</span>
                </label>

                {form.recordPayment && (
                  <>
                    <label className="form-group">
                      <span className="form-label">סכום *</span>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        step="1"
                        value={form.amount}
                        onChange={(event) => handleField("amount", event.target.value)}
                        disabled={working}
                      />
                    </label>
                    <label className="form-group">
                      <span className="form-label">אמצעי תשלום *</span>
                      <select
                        className="form-select"
                        value={form.paymentMethod}
                        onChange={(event) => handleField("paymentMethod", event.target.value)}
                        disabled={working}
                      >
                        <option value="">בחירה</option>
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-group schedule-form-wide">
                      <span className="form-label">תאריך תשלום *</span>
                      <input
                        className="form-input"
                        type="date"
                        max={localDateKey()}
                        value={form.paidAt}
                        onChange={(event) => handleField("paidAt", event.target.value)}
                        disabled={working}
                      />
                    </label>
                  </>
                )}

                <label className="form-group schedule-form-wide">
                  <span className="form-label">הודעה למתאמן</span>
                  <input
                    className="form-input"
                    maxLength={500}
                    value={form.decisionNote}
                    onChange={(event) => handleField("decisionNote", event.target.value)}
                    placeholder="לא חובה"
                    disabled={working}
                  />
                </label>
              </div>
            ) : (
              <label className="form-group">
                <span className="form-label">סיבת הדחייה</span>
                <textarea
                  className="form-textarea"
                  rows="3"
                  maxLength={500}
                  value={form.decisionNote}
                  onChange={(event) => handleField("decisionNote", event.target.value)}
                  placeholder="לדוגמה: השעה תפוסה, אפשר לבקש שעה אחרת"
                  disabled={working}
                />
              </label>
            )}

            {dialogError && <div className="schedule-form-error">{dialogError}</div>}

            <div className="schedule-form-actions">
              <button
                type="submit"
                className={`btn ${dialog.kind === "approve" ? "btn-primary" : "btn-danger"}`}
                disabled={working}
              >
                {working ? "שומר..." : dialog.kind === "approve" ? "אישור וקביעה ביומן" : "דחיית הבקשה"}
              </button>
              <button type="button" className="btn btn-outline" onClick={closeDialog} disabled={working}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
