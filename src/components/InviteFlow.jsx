import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { acceptTraineeInvite, clearPendingInvite } from "../services/invitationService.js";

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

const INPUT = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #E5E2DC",
  fontSize: 14,
  color: "#1E1C19",
  background: "#FAFAF8",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  direction: "ltr",
  textAlign: "left",
};

const LABEL = { fontSize: 13, color: "#4B4841" };
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

const LINK_BUTTON = {
  background: "none",
  border: "none",
  color: "#7C2D3E",
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};

function Header({ subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 4 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#1E1C19" }}>R.K Fitness</div>
      <div style={{ fontSize: 14, color: "#9E9A90", marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

function Field({ label, ...inputProps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={LABEL}>
        {label}
        <input {...inputProps} style={{ ...INPUT, marginTop: 6 }} />
      </label>
    </div>
  );
}

function signUpErrorMessage(error) {
  const code = error?.code ?? "";
  const message = error?.message?.toLowerCase() ?? "";

  if (code === "user_already_exists" || message.includes("already registered")) {
    return "כבר קיים חשבון עם האימייל הזה. עבור לכניסה עם הסיסמה שלך.";
  }
  if (code === "weak_password" || message.includes("password")) {
    return "הסיסמה חלשה מדי. בחר סיסמה ארוכה וחזקה יותר.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "כתובת האימייל אינה תקינה.";
  }
  if (code === "signup_disabled") {
    return "ההרשמה סגורה כרגע. יש לפנות למאמנת.";
  }
  if (error?.status === 429 || code.includes("rate_limit")) {
    return "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.";
  }
  return "לא ניתן להשלים את ההרשמה כרגע. נסה שוב.";
}

function signInErrorMessage(error) {
  const code = error?.code ?? "";

  if (code === "email_not_confirmed") {
    return "יש לאשר קודם את כתובת האימייל דרך הקישור שנשלח אליך.";
  }
  if (error?.status === 429 || code.includes("rate_limit")) {
    return "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.";
  }
  if (error?.status === 400 || code === "invalid_credentials") {
    return "האימייל או הסיסמה אינם נכונים";
  }
  return "לא ניתן להתחבר כרגע. נסה שוב.";
}

// ── Invite link is not a valid token ─────────────────────────────────────
export function InviteInvalidScreen({ onContinue, continueLabel = "למסך הכניסה" }) {
  return (
    <div style={CENTER}>
      <div style={CARD}>
        <Header subtitle="הזמנה להצטרפות" />
        <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}>הקישור אינו בתוקף</div>
        <div style={MUTED}>
          ייתכן שפג תוקפו, שבוטל או שכבר נעשה בו שימוש. יש לבקש מהמאמנת קישור הזמנה חדש.
        </div>
        <button type="button" style={SECONDARY_BUTTON} onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </div>
  );
}

// ── Signed out: create an account (or sign in) to accept the invite ──────
export function InviteAuthForm({ onAuthStarted, onCancel }) {
  const [mode, setMode] = useState("signup"); // signup | login | check-email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSignUp(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("יש להזין אימייל וסיסמה");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
      return;
    }
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setSubmitting(true);
    onAuthStarted();
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) {
        console.warn("Sign-up failed:", authError.status, authError.code);
        setError(signUpErrorMessage(authError));
        return;
      }

      if (data.session) return; // AuthGate takes over and links the invite.

      // With email confirmation on, an existing address comes back with no identities.
      if (data.user && data.user.identities?.length === 0) {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setNotice("כבר קיים חשבון עם האימייל הזה. התחבר עם הסיסמה שלך כדי להשלים את ההצטרפות.");
        return;
      }

      setMode("check-email");
    } catch (authError) {
      console.warn("Sign-up request failed:", authError?.name);
      setError("לא ניתן להשלים את ההרשמה כרגע. בדוק את החיבור ונסה שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("יש להזין אימייל וסיסמה");
      return;
    }

    setSubmitting(true);
    onAuthStarted();
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError) {
        console.warn("Invite sign-in failed:", authError.status, authError.code);
        setError(signInErrorMessage(authError));
      }
    } catch (authError) {
      console.warn("Invite sign-in request failed:", authError?.name);
      setError("לא ניתן להתחבר כרגע. בדוק את החיבור ונסה שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "check-email") {
    return (
      <div style={CENTER}>
        <div style={CARD}>
          <Header subtitle="הזמנה להצטרפות" />
          <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}>כמעט סיימנו</div>
          <div style={MUTED}>
            שלחנו קישור אישור לכתובת <span dir="ltr">{email.trim()}</span>.
            <br />
            לאחר אישור המייל, חזור ללשונית הזו והתחבר כדי להשלים את ההצטרפות.
          </div>
          <button type="button" style={primaryButton(false)} onClick={() => switchMode("login")}>
            אישרתי את המייל, להתחברות
          </button>
        </div>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div style={CENTER}>
      <form onSubmit={isSignup ? handleSignUp : handleSignIn} style={CARD} noValidate>
        <Header subtitle={isSignup ? "הצטרפות לאפליקציה" : "כניסה להשלמת ההצטרפות"} />

        <div style={MUTED}>
          {isSignup
            ? "קיבלת הזמנה מ־R.K Fitness. צור חשבון עם אימייל וסיסמה כדי להתחבר לאזור המתאמן שלך."
            : "התחבר עם החשבון שלך כדי לקבל את ההזמנה."}
        </div>

        {notice && <div style={{ ...MUTED, color: "#7C2D3E" }}>{notice}</div>}

        <Field
          label="אימייל"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
          autoComplete="email"
        />
        <Field
          label="סיסמה"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          autoComplete={isSignup ? "new-password" : "current-password"}
        />
        {isSignup && (
          <Field
            label="אימות סיסמה"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={submitting}
            autoComplete="new-password"
          />
        )}

        {error && <div style={ERROR}>{error}</div>}

        <button type="submit" disabled={submitting} style={primaryButton(submitting)}>
          {submitting
            ? (isSignup ? "יוצר חשבון..." : "מתחבר...")
            : (isSignup ? "יצירת חשבון" : "כניסה")}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            style={LINK_BUTTON}
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            disabled={submitting}
          >
            {isSignup ? "כבר יש לי חשבון" : "אין לי חשבון, להרשמה"}
          </button>
          <button type="button" style={LINK_BUTTON} onClick={onCancel} disabled={submitting}>
            לא עכשיו
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Signed in: redeem the invite through the secure RPC ──────────────────
function acceptErrorKind(error) {
  switch (error?.message) {
    case "Invite invalid":
      return "invalid";
    case "Account already linked":
      return "already-linked";
    case "Account not eligible":
      return "not-eligible";
    default:
      return "failed";
  }
}

export function InviteLinking({
  token,
  role,
  email,
  autoAccept,
  onLinked,
  onDismiss,
  onLogout,
  signingOut,
}) {
  const [state, setState] = useState(() => {
    if (role !== "trainee") return "not-eligible";
    return autoAccept ? "linking" : "confirm";
  });
  const startedRef = useRef(false);

  async function accept() {
    setState("linking");
    try {
      await acceptTraineeInvite(token);
      // The token is single-use; drop it before entering the app.
      clearPendingInvite();
      onLinked();
    } catch (error) {
      console.warn("Accept invite failed:", error?.code);
      const kind = acceptErrorKind(error);
      // Keep the token only when a retry could still succeed.
      if (kind === "invalid" || kind === "already-linked") clearPendingInvite();
      setState(kind);
    }
  }

  useEffect(() => {
    if (state !== "linking" || startedRef.current) return;
    startedRef.current = true;
    accept();
    // Runs once for an automatic accept right after signup/sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "linking") {
    return (
      <div style={CENTER}>
        <div style={{ color: "#9E9A90", fontSize: 16 }}>מחבר את החשבון לאזור המתאמן...</div>
      </div>
    );
  }

  const logoutButton = (
    <button type="button" style={SECONDARY_BUTTON} onClick={onLogout} disabled={signingOut}>
      {signingOut ? "מתנתק..." : "התנתקות והרשמה עם חשבון אחר"}
    </button>
  );

  let title;
  let body;
  let actions;

  if (state === "confirm") {
    title = "חיבור החשבון להזמנה";
    body = (
      <>
        אתה מחובר כ־<span dir="ltr">{email}</span>.
        <br />
        לחבר את החשבון הזה לאזור המתאמן שלך ב־R.K Fitness?
      </>
    );
    actions = (
      <>
        <button type="button" style={primaryButton(false)} onClick={accept}>
          חיבור החשבון
        </button>
        {logoutButton}
      </>
    );
  } else if (state === "not-eligible") {
    title = "החשבון הזה אינו חשבון מתאמן";
    body = "ההזמנה מיועדת לחשבון מתאמן. כדי לקבל אותה, התנתק והירשם עם האימייל של המתאמן.";
    actions = (
      <>
        {logoutButton}
        <button type="button" style={SECONDARY_BUTTON} onClick={onDismiss}>
          המשך לאפליקציה בלי ההזמנה
        </button>
      </>
    );
  } else if (state === "already-linked") {
    title = "החשבון כבר מחובר";
    body = "החשבון הזה כבר מחובר למתאמן, ולכן לא ניתן לחבר אותו להזמנה נוספת.";
    actions = (
      <>
        <button type="button" style={primaryButton(false)} onClick={onDismiss}>
          המשך לאזור המתאמן
        </button>
        {logoutButton}
      </>
    );
  } else if (state === "invalid") {
    title = "הקישור אינו בתוקף";
    body = "ייתכן שפג תוקפו, שבוטל או שכבר נעשה בו שימוש. יש לבקש מהמאמנת קישור הזמנה חדש.";
    actions = (
      <>
        <button type="button" style={SECONDARY_BUTTON} onClick={onDismiss}>
          המשך לאפליקציה
        </button>
        {logoutButton}
      </>
    );
  } else {
    title = "לא ניתן להשלים את החיבור כרגע";
    body = "בדוק את החיבור לאינטרנט ונסה שוב.";
    actions = (
      <>
        <button type="button" style={primaryButton(false)} onClick={accept}>
          נסה שוב
        </button>
        {logoutButton}
      </>
    );
  }

  return (
    <div style={CENTER}>
      <div style={CARD}>
        <Header subtitle="הזמנה להצטרפות" />
        <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}>{title}</div>
        <div style={MUTED}>{body}</div>
        {actions}
      </div>
    </div>
  );
}
