import { supabase } from "../lib/supabase.js";

// Session requests (migration 025). The table is read-only for the app: every
// change goes through an RPC that checks the rules on the server.

const PROOF_BUCKET = "payment-proofs";
export const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const PROOF_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const PROOF_ACCEPT = Object.keys(PROOF_EXTENSIONS).join(",");

export const REQUEST_STATUS_LABELS = {
  pending: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
  cancelled: "בוטל",
};

const REQUEST_COLUMNS =
  "id, trainee_id, requested_date, requested_start_time, trainee_note, payment_proof_path, status, decision_note, decided_at, scheduled_session_id, payment_id, created_at";

const ERROR_MESSAGES = {
  "unsupported-proof": "אפשר לצרף רק תמונה (JPG, PNG או WEBP).",
  "proof-too-large": "התמונה גדולה מדי. הגבול הוא 10MB.",
  "Session requests are for in-person trainees": "בקשת אימון זמינה כרגע רק למתאמנים באימון אישי.",
  "Trainee is not active": "החשבון אינו פעיל כרגע. כדאי לפנות לרוני.",
  "Requested time must be in the future": "אפשר לבקש רק מועד עתידי.",
  "Requested time has passed": "מועד האימון כבר עבר.",
  "Requested date is more than 60 days ahead": "אפשר לבקש אימון עד 60 יום קדימה.",
  "Too many pending requests": "יש כבר 3 בקשות שממתינות לאישור. אפשר לבטל אחת או לחכות לתשובה.",
  "Payment proof is required": "יש לצרף צילום של אישור התשלום.",
  "Request id already used": "הבקשה כבר נשלחה.",
  "Trainee account is not linked": "החשבון עדיין לא שויך למתאמן.",
  "Request is no longer pending": "הבקשה כבר טופלה.",
  "Request not found": "הבקשה לא נמצאה.",
  "Location is required": "יש למלא מיקום.",
  "Invalid duration": "משך האימון צריך להיות בין 15 ל-240 דקות.",
  "Invalid payment amount": "יש למלא סכום תקין.",
  "Payment method is required": "יש לבחור אמצעי תשלום.",
  "Paid date cannot be in the future": "תאריך התשלום לא יכול להיות עתידי.",
  "Session conflict": "יש כבר אימון ביומן שחופף לשעה הזו.",
  "Not authorized": "אין הרשאה לפעולה הזו.",
};

export function sessionRequestErrorMessage(error, fallback) {
  const key = error?.message;
  if (key && Object.hasOwn(ERROR_MESSAGES, key)) return ERROR_MESSAGES[key];
  if (error?.code === "23505") return "כבר קיימת בקשה לאותו מועד.";
  return fallback;
}

function newId() {
  return globalThis.crypto.randomUUID();
}

export function validatePaymentProof(file) {
  if (!file || !Object.hasOwn(PROOF_EXTENSIONS, file.type)) {
    throw new Error("unsupported-proof");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error("proof-too-large");
  }
}

// Trainee: upload the proof under {trainee}/{request}/, then create the
// request with that same id. A failed request removes the uploaded file.
export async function createMySessionRequest({ traineeId, date, startTime, note, file }) {
  validatePaymentProof(file);

  const requestId = newId();
  const path = `${traineeId}/${requestId}/${newId()}.${PROOF_EXTENSIONS[file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc("create_my_session_request", {
    p_request_id: requestId,
    p_requested_date: date,
    p_requested_start_time: startTime,
    p_payment_proof_path: path,
    p_trainee_note: note?.trim() || null,
  });

  if (error) {
    await supabase.storage.from(PROOF_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function fetchMySessionRequests(traineeId) {
  const { data, error } = await supabase
    .from("session_requests")
    .select(REQUEST_COLUMNS)
    .eq("trainee_id", traineeId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data ?? [];
}

export async function cancelMySessionRequest(requestId) {
  const { error } = await supabase.rpc("cancel_my_session_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

// Admin: pending requests first, then the latest decisions.
export async function fetchSessionRequests() {
  const [pending, recent] = await Promise.all([
    supabase
      .from("session_requests")
      .select(REQUEST_COLUMNS)
      .eq("status", "pending")
      .order("requested_date", { ascending: true })
      .order("requested_start_time", { ascending: true }),
    supabase
      .from("session_requests")
      .select(REQUEST_COLUMNS)
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      .limit(10),
  ]);

  if (pending.error) throw pending.error;
  if (recent.error) throw recent.error;
  return { pending: pending.data ?? [], recent: recent.data ?? [] };
}

export async function approveSessionRequest(requestId, input) {
  const { data, error } = await supabase.rpc("approve_session_request", {
    p_request_id: requestId,
    p_location: input.location,
    p_duration_minutes: input.durationMinutes,
    p_record_payment: input.recordPayment,
    p_amount: input.recordPayment ? input.amount : null,
    p_payment_method: input.recordPayment ? input.paymentMethod : null,
    p_paid_at: input.recordPayment ? input.paidAt : null,
    p_decision_note: input.decisionNote?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function rejectSessionRequest(requestId, decisionNote) {
  const { error } = await supabase.rpc("reject_session_request", {
    p_request_id: requestId,
    p_decision_note: decisionNote?.trim() || null,
  });
  if (error) throw error;
}

// A short-lived link, requested only when the proof is shown.
export async function getPaymentProofUrl(path) {
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
