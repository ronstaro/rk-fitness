import { useEffect, useState, cloneElement } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

const CENTER = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  fontFamily: "inherit",
  direction: "rtl",
};

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (active) setSession(newSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("יש להזין אימייל וסיסמה");
      return;
    }

    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setSubmitting(false);

    if (authError) {
      // Log sanitized info for development — no credentials
      console.warn("Login failed:", authError.status, authError.name);
      if (authError.status === 400 || authError.message?.toLowerCase().includes("invalid")) {
        setError("האימייל או הסיסמה אינם נכונים");
      } else {
        setError("לא ניתן להתחבר כרגע. נסה שוב.");
      }
    }
  }

  async function handleLogout() {
    setSignOutError("");
    setSigningOut(true);
    const { error: signOutErr } = await supabase.auth.signOut();
    setSigningOut(false);
    if (signOutErr) {
      console.warn("Sign-out failed:", signOutErr.name);
      setSignOutError("לא ניתן להתנתק כרגע. נסה שוב.");
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
    return cloneElement(children, {
      onLogout: handleLogout,
      signingOut,
      signOutError,
    });
  }

  // ── Login form ────────────────────────────────────────────────────────────
  return (
    <div style={CENTER}>
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 360,
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

        {error && (
          <div style={{ color: "#b91c1c", fontSize: 13, textAlign: "center" }}>{error}</div>
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
      </form>
    </div>
  );
}

const inputStyle = {
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
