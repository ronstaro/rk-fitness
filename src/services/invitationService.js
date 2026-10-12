import { supabase } from "../lib/supabase.js";
import { appBaseUrl } from "../lib/appUrl.js";

// The token travels in the URL fragment so it is never sent to the server
// in request logs or Referer headers.
export function buildInviteLink(token) {
  return `${appBaseUrl()}/#invite=${encodeURIComponent(token)}`;
}

// Invite links look like `${appBaseUrl()}/#invite=<token>` (see buildInviteLink).
// The token is a 43-char base64url string. It is moved out of the address bar
// into sessionStorage as soon as the app loads, so it survives a reload of the
// same tab but is not left in the URL or browser history.
const PENDING_INVITE_KEY = "rk-fitness-pending-invite";
// The email confirmation link often opens in a new tab (especially on mobile),
// which has its own sessionStorage. After signup, the token is also kept in
// localStorage, tied to the signup email and a short lifetime, so the tab that
// opens from the confirmation email can offer to finish linking. The token is
// still redeemed only through accept_trainee_invite.
const INVITE_HANDOFF_KEY = "rk-fitness-invite-handoff";
const INVITE_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_HASH_PREFIX = "#invite=";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function storePendingInvite(token) {
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, token);
  } catch {
    // Storage unavailable (private mode); the invite still works in this page view.
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Nothing to clear.
  }
  try {
    localStorage.removeItem(INVITE_HANDOFF_KEY);
  } catch {
    // Nothing to clear.
  }
}

// Called after a signup that still needs email confirmation.
export function saveInviteHandoff(token, email) {
  if (!TOKEN_PATTERN.test(token ?? "") || !email) return;
  try {
    localStorage.setItem(
      INVITE_HANDOFF_KEY,
      JSON.stringify({ token, email: email.trim().toLowerCase(), savedAt: Date.now() }),
    );
  } catch {
    // Storage unavailable; the user can still sign in from the original tab.
  }
}

// Returns the handed-off invite when it belongs to `email`, otherwise null.
// The entry is moved into this tab's sessionStorage, so it is used once.
export function takeInviteHandoff(email) {
  let entry = null;
  try {
    entry = JSON.parse(localStorage.getItem(INVITE_HANDOFF_KEY) ?? "null");
  } catch {
    entry = null;
  }
  if (!entry) return null;

  const expired = !(Date.now() - entry.savedAt < INVITE_HANDOFF_TTL_MS);
  if (expired || !TOKEN_PATTERN.test(entry.token ?? "")) {
    clearPendingInvite();
    return null;
  }
  if (!email || entry.email !== email.trim().toLowerCase()) return null;

  try {
    localStorage.removeItem(INVITE_HANDOFF_KEY);
  } catch {
    // Ignore; the token is single-use on the server anyway.
  }
  storePendingInvite(entry.token);
  return { token: entry.token, malformed: false };
}

// Returns { token, malformed } when an invite is pending, otherwise null.
export function readPendingInvite() {
  const { hash, pathname, search } = window.location;

  if (hash.startsWith(INVITE_HASH_PREFIX)) {
    let token = "";
    try {
      token = decodeURIComponent(hash.slice(INVITE_HASH_PREFIX.length)).trim();
    } catch {
      token = "";
    }
    window.history.replaceState(null, "", `${pathname}${search}`);

    if (!TOKEN_PATTERN.test(token)) {
      clearPendingInvite();
      return { token: "", malformed: true };
    }

    storePendingInvite(token);
    return { token, malformed: false };
  }

  try {
    const stored = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (stored && TOKEN_PATTERN.test(stored)) return { token: stored, malformed: false };
  } catch {
    // Storage unavailable.
  }

  return null;
}

// Maps the fixed messages raised by the invitation RPCs to Hebrew UI text.
// Anything else falls back to a generic message so internal details never
// reach the screen.
const INVITE_ERROR_MESSAGES = {
  "Admin access required": "אין הרשאה לבצע פעולה זו.",
  "Trainee not found": "המתאמן לא נמצא.",
  "Trainee already linked": "למתאמן כבר יש חשבון מחובר.",
  "Invite invalid": "ההזמנה אינה בתוקף. יש לבקש מהמאמנת קישור חדש.",
  "Account not eligible": "לא ניתן לחבר חשבון זה להזמנה.",
  "Account already linked": "החשבון הזה כבר מחובר למתאמן.",
};

export function inviteErrorMessage(error) {
  return INVITE_ERROR_MESSAGES[error?.message] ?? "הפעולה נכשלה. נסה שוב.";
}

export async function createTraineeInvite(traineeId) {
  const { data: token, error } = await supabase.rpc("create_trainee_invite", {
    p_trainee_id: traineeId,
  });

  if (error) throw error;
  return { token, link: buildInviteLink(token) };
}

export async function getTraineeInviteStatus(traineeId) {
  const { data, error } = await supabase
    .rpc("get_trainee_invite_status", { p_trainee_id: traineeId })
    .maybeSingle();

  if (error) throw error;
  return data ?? { status: "none", created_at: null, expires_at: null, used_at: null };
}

export async function revokeTraineeInvite(traineeId) {
  const { data, error } = await supabase.rpc("revoke_trainee_invite", {
    p_trainee_id: traineeId,
  });

  if (error) throw error;
  return data;
}

export async function acceptTraineeInvite(token) {
  const { data, error } = await supabase.rpc("accept_trainee_invite", {
    p_token: token,
  });

  if (error) throw error;
  return data;
}
