import { supabase } from "../lib/supabase.js";

// Supabase sends auth email links back to the app root. A recovery link lands
// as `#access_token=...&type=recovery`; an expired or reused link lands as
// `#error=...&error_code=...`. The fragment is read once, when the app loads,
// before the Supabase client consumes it.
const RECOVERY_KEY = "rk-fitness-password-recovery";

export function storeRecoveryFlag() {
  try {
    sessionStorage.setItem(RECOVERY_KEY, "1");
  } catch {
    // Storage unavailable (private mode); recovery still works in this page view.
  }
}

export function clearRecoveryFlag() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Nothing to clear.
  }
}

function readRecoveryFlag() {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

function readAuthRedirect() {
  if (typeof window === "undefined") return { recovery: false, linkError: false };

  const { hash, pathname, search } = window.location;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  if (params.get("error") || params.get("error_code")) {
    // Drop the error so it is not shown again after a reload.
    window.history.replaceState(null, "", `${pathname}${search}`);
    return { recovery: false, linkError: true };
  }

  if (params.get("type") === "recovery" && params.get("access_token")) {
    // The tokens stay in the URL; the Supabase client reads and removes them.
    storeRecoveryFlag();
    return { recovery: true, linkError: false };
  }

  return { recovery: readRecoveryFlag(), linkError: false };
}

export const initialAuthRedirect = readAuthRedirect();

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });

  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) throw error;
}

export function resetRequestErrorMessage(error) {
  const code = error?.code ?? "";

  if (error?.status === 429 || code.includes("rate_limit")) {
    return "נשלחו יותר מדי בקשות. נסה שוב בעוד כמה דקות.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "כתובת האימייל אינה תקינה.";
  }
  return "לא ניתן לשלוח קישור לאיפוס כרגע. נסה שוב.";
}

// Returns { message, expired }. `expired` means the recovery session is gone
// and the user needs a new reset link.
export function updatePasswordErrorMessage(error) {
  const code = error?.code ?? "";

  if (code === "same_password") {
    return { message: "הסיסמה החדשה זהה לסיסמה הקודמת. בחר סיסמה אחרת.", expired: false };
  }
  if (code === "weak_password") {
    return { message: "הסיסמה חלשה מדי. בחר סיסמה ארוכה וחזקה יותר.", expired: false };
  }
  if (error?.status === 429 || code.includes("rate_limit")) {
    return { message: "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.", expired: false };
  }
  if (
    error?.status === 401 ||
    error?.status === 403 ||
    code === "session_not_found" ||
    code === "session_expired" ||
    code === "reauthentication_needed" ||
    error?.name === "AuthSessionMissingError"
  ) {
    return { message: "קישור האיפוס פג תוקף. יש לבקש קישור חדש.", expired: true };
  }
  return { message: "לא ניתן לעדכן את הסיסמה כרגע. נסה שוב.", expired: false };
}
