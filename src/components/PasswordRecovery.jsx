import { useState } from "react";
import {
  requestPasswordReset,
  resetRequestErrorMessage,
  updatePassword,
  updatePasswordErrorMessage,
} from "../services/authService.js";

const MIN_PASSWORD_LENGTH = 8;

const CENTER = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "24px 16px",
  boxSizing: "border-box",
  fontFamily: "inherit",
  direction: "rtl",
};

const CARD = {
  width: "100%",
  maxWidth: 380,
  boxSizing: "border-box",
  padding: "36px 28px",
  borderRadius: 16,
  border: "1px solid #E5E2DC",
  background: "#fff",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

// 16px keeps iOS Safari from zooming the page when the field gets focus.
const INPUT = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #E5E2DC",
  fontSize: 16,
  color: "#1E1C19",
  background: "#FAFAF8",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  direction: "ltr",
  textAlign: "left",
  marginTop: 6,
};

const LABEL = { display: "flex", flexDirection: "column", fontSize: 13, color: "#4B4841" };
const MUTED = { fontSize: 14, color: "#615E57", lineHeight: 1.6, textAlign: "center" };
const ERROR = { color: "#b91c1c", fontSize: 13, textAlign: "center", lineHeight: 1.5 };

function primaryButton(disabled) {
  return {
    padding: "10px 0",
    borderRadius: 8,
    border: "none",
    background: disabled ? "#9E9A90" : "#7C2D3E",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const SECONDARY_BUTTON = {
  padding: "9px 0",
  borderRadius: 8,
  border: "1px solid #E5E2DC",
  background: "#fff",
  color: "#4B4841",
  fontSize: 14,
  cursor: "pointer",
};

function Header({ subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 4 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#1E1C19" }}>R.K Fitness</div>
      <div style={{ fontSize: 14, color: "#9E9A90", marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

// ── Signed out: ask for a reset link ─────────────────────────────────────
export function ForgotPasswordForm({ initialEmail = "", invitePending = false, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("יש להזין כתובת אימייל תקינה");
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setSent(true);
    } catch (requestError) {
      console.warn("Password reset request failed:", requestError?.status, requestError?.code);
      setError(
        requestError?.name === "AuthRetryableFetchError" || !requestError?.status
          ? "לא ניתן לשלוח קישור לאיפוס כרגע. בדוק את החיבור ונסה שוב."
          : resetRequestErrorMessage(requestError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={CENTER}>
        <div style={CARD}>
          <Header subtitle="איפוס סיסמה" />
          <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}>בדוק את תיבת המייל</div>
          <div style={MUTED}>
            אם קיים חשבון עם הכתובת <bdi dir="ltr">{email.trim()}</bdi>, נשלח אליו קישור לאיפוס הסיסמה.
            <br />
            הקישור תקף לזמן מוגבל. אם המייל לא הגיע, כדאי לבדוק גם בתיקיית הספאם.
            {invitePending && (
              <>
                <br />
                לאחר איפוס הסיסמה, פתח שוב את קישור ההזמנה כדי להשלים את ההצטרפות.
              </>
            )}
          </div>
          <button type="button" style={primaryButton(false)} onClick={onBack}>
            חזרה לכניסה
          </button>
          <button type="button" style={SECONDARY_BUTTON} onClick={() => setSent(false)}>
            שליחה חוזרת
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={CENTER}>
      <form onSubmit={handleSubmit} style={CARD} noValidate>
        <Header subtitle="איפוס סיסמה" />
        <div style={MUTED}>הזן את כתובת האימייל של החשבון ונשלח אליך קישור לבחירת סיסמה חדשה.</div>

        <label style={LABEL}>
          אימייל
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            autoComplete="email"
            inputMode="email"
            style={INPUT}
          />
        </label>

        {error && <div style={ERROR} role="alert">{error}</div>}

        <button type="submit" disabled={submitting} style={primaryButton(submitting)}>
          {submitting ? "שולח..." : "שליחת קישור לאיפוס"}
        </button>
        <button type="button" style={SECONDARY_BUTTON} onClick={onBack} disabled={submitting}>
          חזרה לכניסה
        </button>
      </form>
    </div>
  );
}

// ── Signed in from a recovery link: choose a new password ────────────────
export function ResetPasswordForm({ email, onDone, onCancel, onRequestNewLink, signingOut }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
      return;
    }
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch (updateError) {
      console.warn("Password update failed:", updateError?.status, updateError?.code);
      if (updateError?.name === "AuthRetryableFetchError") {
        setError("לא ניתן לעדכן את הסיסמה כרגע. בדוק את החיבור ונסה שוב.");
      } else {
        const result = updatePasswordErrorMessage(updateError);
        setError(result.message);
        setExpired(result.expired);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={CENTER}>
        <div style={CARD}>
          <Header subtitle="איפוס סיסמה" />
          <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}>הסיסמה עודכנה</div>
          <div style={MUTED}>מעכשיו יש להתחבר עם הסיסמה החדשה.</div>
          <button type="button" style={primaryButton(false)} onClick={onDone}>
            המשך לאפליקציה
          </button>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div style={CENTER}>
        <div style={CARD}>
          <Header subtitle="איפוס סיסמה" />
          <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}>הקישור אינו בתוקף</div>
          <div style={MUTED}>{error}</div>
          <button type="button" style={primaryButton(signingOut)} onClick={onRequestNewLink} disabled={signingOut}>
            {signingOut ? "רגע..." : "בקשת קישור חדש"}
          </button>
        </div>
      </div>
    );
  }

  const busy = submitting || signingOut;

  return (
    <div style={CENTER}>
      <form onSubmit={handleSubmit} style={CARD} noValidate>
        <Header subtitle="איפוס סיסמה" />
        <div style={MUTED}>
          בחר סיסמה חדשה לחשבון
          {email && (
            <>
              <br />
              <bdi dir="ltr">{email}</bdi>
            </>
          )}
        </div>

        {/* Lets password managers attach the new password to the right account. */}
        <input type="email" value={email ?? ""} autoComplete="username" readOnly hidden />

        <label style={LABEL}>
          סיסמה חדשה
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            autoComplete="new-password"
            style={INPUT}
          />
        </label>
        <label style={LABEL}>
          אימות סיסמה חדשה
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            autoComplete="new-password"
            style={INPUT}
          />
        </label>
        <div style={{ fontSize: 12, color: "#9E9A90" }}>לפחות {MIN_PASSWORD_LENGTH} תווים.</div>

        {error && <div style={ERROR} role="alert">{error}</div>}

        <button type="submit" disabled={busy} style={primaryButton(busy)}>
          {submitting ? "שומר..." : "שמירת סיסמה חדשה"}
        </button>
        <button type="button" style={SECONDARY_BUTTON} onClick={onCancel} disabled={busy}>
          {signingOut ? "מתנתק..." : "ביטול והתנתקות"}
        </button>
      </form>
    </div>
  );
}
