import { useEffect, useRef, useState } from "react";
import {
  createTraineeInvite,
  getTraineeInviteStatus,
  inviteErrorMessage,
  revokeTraineeInvite,
} from "../services/invitationService.js";

const STATUS_BADGES = {
  linked: { label: "חשבון מחובר", className: "badge-active" },
  pending: { label: "הזמנה פעילה", className: "badge-burg" },
  expired: { label: "פג תוקף", className: "badge-warn" },
  revoked: { label: "הזמנה בוטלה", className: "badge-inactive" },
  none: { label: "לא הוזמן", className: "badge-inactive" },
};

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inviteMessage(traineeName, link) {
  const greeting = traineeName ? `היי ${traineeName},` : "היי,";
  return `${greeting}\nזה הקישור להצטרפות לאפליקציית R.K Fitness:\n${link}\nהקישור אישי, בתוקף ל־7 ימים ולשימוש חד־פעמי.`;
}

export default function TraineeInviteCard({ traineeId, traineeName, isLinked, whatsappUrl }) {
  const [inviteStatus, setInviteStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const linkInputRef = useRef(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const status = await getTraineeInviteStatus(traineeId);
        if (active) setInviteStatus(status);
      } catch (err) {
        console.warn("Invite status failed:", err?.code);
        if (active) setLoadError("לא ניתן לטעון את סטטוס ההזמנה.");
      } finally {
        if (active) setLoading(false);
      }
    }

    // The raw link is only known right after creation; never carry it across trainees.
    setInviteLink("");
    setActionError("");
    setCopied(false);
    load();

    return () => {
      active = false;
    };
  }, [traineeId, isLinked, reloadKey]);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  const busy = action !== "";
  const status = isLinked ? "linked" : inviteStatus?.status ?? "none";
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.none;

  // The action itself already succeeded. If the status refresh fails, show the
  // expected status instead of an error so a freshly created link stays visible.
  async function refreshStatus(fallbackStatus) {
    try {
      setInviteStatus(await getTraineeInviteStatus(traineeId));
    } catch (err) {
      console.warn("Invite status refresh failed:", err?.code);
      setInviteStatus({ status: fallbackStatus, created_at: null, expires_at: null, used_at: null });
    }
  }

  async function handleCreate() {
    if (busy) return;
    if (
      status === "pending" &&
      !window.confirm("ליצור קישור חדש? הקישור הקודם יפסיק לעבוד.")
    ) {
      return;
    }

    setAction("creating");
    setActionError("");
    setCopied(false);
    try {
      const { link } = await createTraineeInvite(traineeId);
      setInviteLink(link);
      await refreshStatus("pending");
    } catch (err) {
      console.warn("Create invite failed:", err?.code);
      setActionError(inviteErrorMessage(err));
    } finally {
      setAction("");
    }
  }

  async function handleRevoke() {
    if (busy) return;
    if (!window.confirm("לבטל את ההזמנה? הקישור שנשלח יפסיק לעבוד.")) return;

    setAction("revoking");
    setActionError("");
    try {
      await revokeTraineeInvite(traineeId);
      setInviteLink("");
      setCopied(false);
      await refreshStatus("revoked");
    } catch (err) {
      console.warn("Revoke invite failed:", err?.code);
      setActionError(inviteErrorMessage(err));
    } finally {
      setAction("");
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      linkInputRef.current?.select();
      setActionError("לא ניתן להעתיק אוטומטית. סמן את הקישור והעתק ידנית.");
    }
  }

  const whatsappHref = inviteLink
    ? `${whatsappUrl || "https://wa.me/"}?text=${encodeURIComponent(inviteMessage(traineeName, inviteLink))}`
    : "";

  return (
    <section className="card trainee-detail-card">
      <div className="flex-between">
        <div className="section-title">🔗 גישה לאפליקציה</div>
        {!loading && !loadError && <span className={`badge ${badge.className}`}>{badge.label}</span>}
      </div>

      {loading && <div className="trainee-unavailable-state">בודק סטטוס הזמנה...</div>}

      {!loading && loadError && (
        <>
          <div className="alert-strip danger">{loadError}</div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            נסה שוב
          </button>
        </>
      )}

      {!loading && !loadError && (
        <>
          {status === "linked" && (
            <div className="trainee-unavailable-state">
              המתאמן מחובר לחשבון ויכול להיכנס לאפליקציה.
            </div>
          )}

          {status === "none" && (
            <p className="muted text-sm">
              צור קישור הזמנה ושלח אותו למתאמן ב־WhatsApp. הקישור בתוקף ל־7 ימים ולשימוש חד־פעמי.
            </p>
          )}

          {status === "pending" && (
            <p className="muted text-sm">
              {inviteStatus?.expires_at
                ? `ההזמנה בתוקף עד ${formatDateTime(inviteStatus.expires_at)}.`
                : "ההזמנה בתוקף ל־7 ימים."}
              {!inviteLink && " מטעמי אבטחה הקישור מוצג רק בעת יצירתו. כדי לשלוח שוב, צור קישור חדש."}
            </p>
          )}

          {status === "expired" && (
            <p className="muted text-sm">
              תוקף ההזמנה פג{inviteStatus?.expires_at ? ` ב־${formatDateTime(inviteStatus.expires_at)}` : ""}. צור קישור חדש כדי להזמין שוב.
            </p>
          )}

          {status === "revoked" && (
            <p className="muted text-sm">ההזמנה בוטלה. צור קישור חדש כדי להזמין שוב.</p>
          )}

          {inviteLink && status === "pending" && (
            <div className="mt-12">
              <input
                ref={linkInputRef}
                className="form-input"
                value={inviteLink}
                readOnly
                dir="ltr"
                aria-label="קישור הזמנה"
                onFocus={(event) => event.target.select()}
              />
              <div className="trainee-profile-actions mt-12">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleCopy}
                  disabled={busy}
                >
                  {copied ? "הקישור הועתק ✓" : "העתק קישור"}
                </button>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-whatsapp btn-sm"
                >
                  שלח ב־WhatsApp
                </a>
              </div>
              <p className="muted text-sm mt-12">
                הקישור מוצג פעם אחת בלבד. אם תסגור את המסך לפני השליחה, צור קישור חדש.
              </p>
            </div>
          )}

          {actionError && <div className="alert-strip danger mt-12">{actionError}</div>}

          {status !== "linked" && (
            <div className="trainee-profile-actions mt-12">
              <button
                type="button"
                className={status === "pending" ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"}
                onClick={handleCreate}
                disabled={busy}
              >
                {action === "creating"
                  ? "יוצר קישור..."
                  : status === "none"
                    ? "צור קישור הזמנה"
                    : "צור קישור חדש"}
              </button>
              {status === "pending" && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleRevoke}
                  disabled={busy}
                >
                  {action === "revoking" ? "מבטל..." : "בטל הזמנה"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
