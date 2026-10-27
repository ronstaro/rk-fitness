import { useEffect, useRef, useState } from "react";
import { fetchTraineeProfile } from "../services/traineeHomeService.js";
import {
  PROOF_ACCEPT,
  REQUEST_STATUS_LABELS,
  approveSessionRequest,
  cancelMySessionRequest,
  createMySessionRequest,
  fetchMySessionRequests,
  fetchSessionRequests,
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

export function SessionRequestsPanel({ trainees, hasConflict, onScheduled }) {
  const [data, setData] = useState({ pending: [], recent: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [working, setWorking] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchSessionRequests()
      .then((rows) => {
        if (!active) return;
        setData(rows);
        setLoadError("");
      })
      .catch((error) => {
        console.error("Session requests fetch error:", error);
        if (active) setLoadError("לא ניתן לטעון את בקשות האימון.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

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
    setReloadKey((key) => key + 1);
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

  if (loading) return null;

  return (
    <section className="schedule-list-section session-requests-panel">
      <div className="schedule-section-title">
        <div>
          <h3>בקשות אימון ממתאמנים</h3>
          <p>
            {data.pending.length === 0
              ? "אין בקשות שממתינות לאישור"
              : `${data.pending.length} בקשות ממתינות לאישור`}
          </p>
        </div>
        {data.recent.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRecent((value) => !value)}>
            {showRecent ? "הסתרת החלטות אחרונות" : "החלטות אחרונות"}
          </button>
        )}
      </div>

      {loadError && (
        <div className="schedule-error-strip">
          {loadError}{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
            נסה שוב
          </button>
        </div>
      )}

      {data.pending.length > 0 && (
        <div className="session-request-admin-list">
          {data.pending.map((request) => (
            <article className="card session-request-admin" key={request.id}>
              <PaymentProof path={request.payment_proof_path} />
              <div className="session-request-admin-body">
                <strong>{traineeName(request)}</strong>
                <span>{formatRequestDate(request.requested_date)} · {formatTime(request.requested_start_time)}</span>
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

      {showRecent && data.recent.length > 0 && (
        <div className="schedule-session-list card session-request-recent">
          {data.recent.map((request) => (
            <article className="session-request-row" key={request.id}>
              <div>
                <strong>{traineeName(request)}</strong>
                <small>
                  {formatRequestDate(request.requested_date)} · {formatTime(request.requested_start_time)}
                  {request.payment_id ? " · תשלום נרשם" : ""}
                </small>
                {request.decision_note && <small>{request.decision_note}</small>}
              </div>
              <RequestStatus status={request.status} />
            </article>
          ))}
        </div>
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
