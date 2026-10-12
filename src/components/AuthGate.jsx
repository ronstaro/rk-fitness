import { useEffect, useRef, useState, cloneElement } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { getAccessContext } from "../services/accessService.js";
import {
  clearPendingInvite,
  readPendingInvite,
  saveInviteHandoff,
  takeInviteHandoff,
} from "../services/invitationService.js";
import { InviteAuthForm, InviteInvalidScreen, InviteLinking } from "./InviteFlow.jsx";
import { clearRecoveryFlag, initialAuthRedirect, storeRecoveryFlag } from "../services/authService.js";
import { ForgotPasswordForm, ResetPasswordForm } from "./PasswordRecovery.jsx";
import { clearNavigationMemory } from "../lib/navigationMemory.js";

const LINK_ERROR_NOTICE = "הקישור שנפתח אינו בתוקף או שכבר נעשה בו שימוש. אפשר להתחבר, או לבקש קישור חדש לאיפוס סיסמה.";
const RECOVERY_EXPIRED_NOTICE = "קישור האיפוס אינו בתוקף. יש לבקש קישור חדש.";

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

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [accessContext, setAccessContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  // A pending `#invite=<token>` link. It is read once and removed from the URL.
  const [invite, setInvite] = useState(() => (isSupabaseConfigured ? readPendingInvite() : null));
  // True once the user signs up or signs in from the invite screen, so the
  // invite is redeemed without asking again.
  const inviteAuthRef = useRef(false);
  // True while the user is signed in through a password recovery link and
  // still has to choose a new password.
  const [recovery, setRecovery] = useState(initialAuthRedirect.recovery);
  const [signedOutView, setSignedOutView] = useState("login"); // login | forgot
  const [notice, setNotice] = useState(initialAuthRedirect.linkError ? LINK_ERROR_NOTICE : "");
  // The user whose access context is currently loaded and shown.
  const accessUserIdRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadAccessContext(userId) {
      try {
        const context = await getAccessContext();
        if (active) {
          accessUserIdRef.current = userId;
          setAccessContext(context);
        }
      } catch (accessError) {
        console.warn("Access check failed:", accessError?.name);
        if (active) {
          accessUserIdRef.current = null;
          setAccessContext(null);
          setError("לא ניתן לבדוק את הרשאות החשבון. נסה להתחבר מחדש.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    async function loadSession() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (active) setSession(data.session);

        if (!data.session && initialAuthRedirect.recovery) {
          clearRecoveryFlag();
          if (active) {
            setRecovery(false);
            setNotice(RECOVERY_EXPIRED_NOTICE);
          }
        }

        if (data.session) {
          await loadAccessContext(data.session.user.id);
        }
      } catch (sessionError) {
        console.warn("Session check failed:", sessionError?.name);
        if (active) {
          setSession(null);
          setError("לא ניתן לבדוק את מצב ההתחברות. נסה להתחבר מחדש.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") storeRecoveryFlag();
      if (event === "SIGNED_OUT") {
        clearRecoveryFlag();
        clearNavigationMemory();
      }

      if (active) {
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") setRecovery(false);
        // Same user, fresh tokens or new password: keep the current screen
        // instead of reloading access and remounting the app. Supabase also
        // sends SIGNED_IN for the same user every time the tab becomes visible
        // again, which used to send the app back to its first screen.
        const sameUser = Boolean(newSession) && newSession.user.id === accessUserIdRef.current;
        if (
          newSession &&
          (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || (sameUser && event === "SIGNED_IN"))
        ) {
          setSession(newSession);
          return;
        }
        accessUserIdRef.current = null;
        setSession(newSession);
        setAccessContext(null);
        if (newSession) {
          setLoading(true);
          setTimeout(() => loadAccessContext(newSession.user.id), 0);
        } else {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // A tab opened from the confirmation email has no invite of its own; pick up
  // the one saved at signup when it belongs to the signed-in email.
  const sessionEmail = session?.user?.email ?? null;
  useEffect(() => {
    if (!sessionEmail || invite) return;
    const handoff = takeInviteHandoff(sessionEmail);
    if (handoff) setInvite(handoff);
  }, [sessionEmail, invite]);

  async function handleLogin(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setNotice("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("יש להזין אימייל וסיסמה");
      return;
    }

    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError) {
        // Log sanitized info for development — no credentials
        console.warn("Login failed:", authError.status, authError.name);
        if (authError.code === "email_not_confirmed") {
          setError("יש לאשר קודם את כתובת האימייל דרך הקישור שנשלח אליך.");
        } else if (authError.status === 429) {
          setError("יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.");
        } else if (authError.status === 400 || authError.message?.toLowerCase().includes("invalid")) {
          setError("האימייל או הסיסמה אינם נכונים");
        } else {
          setError("לא ניתן להתחבר כרגע. נסה שוב.");
        }
      }
    } catch (authError) {
      console.warn("Login request failed:", authError?.name);
      setError("לא ניתן להתחבר כרגע. בדוק את החיבור ונסה שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  function openForgotPassword() {
    setError("");
    setNotice("");
    setSignedOutView("forgot");
  }

  function finishRecovery() {
    clearRecoveryFlag();
    setRecovery(false);
  }

  function requestNewResetLink() {
    setSignedOutView("forgot");
    handleLogout();
  }

  function dismissInvite() {
    clearPendingInvite();
    inviteAuthRef.current = false;
    setInvite(null);
  }

  async function handleInviteLinked() {
    dismissInvite();
    setLoading(true);
    try {
      setAccessContext(await getAccessContext());
    } catch (accessError) {
      console.warn("Access check failed:", accessError?.name);
      accessUserIdRef.current = null;
      setAccessContext(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    inviteAuthRef.current = false;
    setSignOutError("");
    setSigningOut(true);

    try {
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) {
        console.warn("Sign-out failed:", signOutErr.name);
        setSignOutError("לא ניתן להתנתק כרגע. נסה שוב.");
      }
    } catch (signOutErr) {
      console.warn("Sign-out request failed:", signOutErr?.name);
      setSignOutError("לא ניתן להתנתק כרגע. בדוק את החיבור ונסה שוב.");
    } finally {
      setSigningOut(false);
    }
  }

  // ── Unconfigured (dev without .env.local) ────────────────────────────────
  if (!isSupabaseConfigured) {
    return (
      <div style={CENTER}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>R.K Fitness</div>
        <div style={{ color: "#9E9A90", fontSize: 14 }}>
          Supabase לא מוגדר. יש להוסיף קובץ <code>.env.local</code> עם{" "}
          <code>VITE_SUPABASE_URL</code> ו-<code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={CENTER}>
        <div style={{ color: "#9E9A90", fontSize: 16 }}>טוען...</div>
      </div>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────
  if (session) {
    // A recovery link signs the user in; they choose a new password first.
    if (recovery) {
      return (
        <ResetPasswordForm
          email={session.user.email}
          onDone={finishRecovery}
          onCancel={handleLogout}
          onRequestNewLink={requestNewResetLink}
          signingOut={signingOut}
        />
      );
    }

    if (!accessContext) {
      return (
        <div style={CENTER}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>לא ניתן לאמת הרשאות</div>
          <div style={{ color: "#615E57", fontSize: 14, marginBottom: 16 }}>
            נסה להתנתק ולהתחבר מחדש.
          </div>
          <button onClick={handleLogout} disabled={signingOut} style={{ ...inputStyle, cursor: "pointer" }}>
            {signingOut ? "מתנתק..." : "התנתקות"}
          </button>
        </div>
      );
    }

    if (invite) {
      if (invite.malformed) {
        return <InviteInvalidScreen onContinue={dismissInvite} continueLabel="המשך לאפליקציה" />;
      }

      return (
        <InviteLinking
          key={`${session.user.id}:${invite.token}`}
          token={invite.token}
          role={accessContext.role}
          email={session.user.email}
          autoAccept={inviteAuthRef.current}
          onLinked={handleInviteLinked}
          onDismiss={dismissInvite}
          onLogout={handleLogout}
          signingOut={signingOut}
        />
      );
    }

    if (accessContext?.role === "admin" && !accessContext.businessOwnerId) {
      return (
        <div style={CENTER}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>אין הרשאת ניהול פעילה</div>
          <div style={{ color: "#615E57", fontSize: 14, marginBottom: 16 }}>
            החשבון מחובר, אך עדיין לא שויך לעסק.
          </div>
          <button onClick={handleLogout} disabled={signingOut} style={{ ...inputStyle, cursor: "pointer" }}>
            {signingOut ? "מתנתק..." : "התנתקות"}
          </button>
        </div>
      );
    }

    return cloneElement(children, {
      onLogout: handleLogout,
      signingOut,
      signOutError,
      accountRole: accessContext?.role,
      accountUserId: session.user.id,
    });
  }

  // ── Forgot password (signed out) ─────────────────────────────────────────
  if (signedOutView === "forgot") {
    return (
      <ForgotPasswordForm
        initialEmail={email.trim()}
        invitePending={Boolean(invite && !invite.malformed)}
        onBack={() => setSignedOutView("login")}
      />
    );
  }

  // ── Invite landing (signed out) ──────────────────────────────────────────
  if (invite) {
    if (invite.malformed) {
      return <InviteInvalidScreen onContinue={dismissInvite} />;
    }

    return (
      <InviteAuthForm
        onAuthStarted={() => {
          inviteAuthRef.current = true;
        }}
        onAwaitingConfirmation={(signupEmail) => saveInviteHandoff(invite.token, signupEmail)}
        onCancel={dismissInvite}
        onForgotPassword={openForgotPassword}
      />
    );
  }

  // ── Login form ────────────────────────────────────────────────────────────
  return (
    <div style={CENTER}>
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 360,
          boxSizing: "border-box",
          padding: "40px 32px",
          borderRadius: 16,
          border: "1px solid #E5E2DC",
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1E1C19" }}>R.K Fitness</div>
          <div style={{ fontSize: 14, color: "#9E9A90", marginTop: 4 }}>כניסה לחשבון</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#4B4841" }}>אימייל</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={submitting}
            autoComplete="email"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#4B4841" }}>סיסמה</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
            style={inputStyle}
          />
        </div>

        {notice && (
          <div style={{ color: "#7C2D3E", fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>{notice}</div>
        )}

        {error && (
          <div style={{ color: "#b91c1c", fontSize: 13, textAlign: "center" }} role="alert">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 0",
            borderRadius: 8,
            border: "none",
            background: submitting ? "#9E9A90" : "#7C2D3E",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            marginTop: 4,
          }}
        >
          {submitting ? "מתחבר..." : "כניסה"}
        </button>

        <button
          type="button"
          onClick={openForgotPassword}
          disabled={submitting}
          style={{
            background: "none",
            border: "none",
            color: "#7C2D3E",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
            alignSelf: "center",
          }}
        >
          שכחתי סיסמה
        </button>
      </form>
    </div>
  );
}

// 16px keeps iOS Safari from zooming the page when a field gets focus.
const inputStyle = {
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
};
