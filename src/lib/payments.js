// Payment helpers shared by Revenue, the trainee profile and the dashboard.
// Dates are plain "YYYY-MM-DD" strings so no time zone can shift a day.

export const PAYMENT_METHODS = ["העברה בנקאית", "ביט", "פייבוקס", "אשראי", "מזומן", "אחר"];

export const REMOVED_PAYMENT_NOTE = "__removed_by_admin__";

// Older trainee profiles stored "Bit"; it is the same method as "ביט".
export function paymentMethodLabel(method) {
  return method === "Bit" ? "ביט" : method;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayNumber(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

// Same day next month, or that month's last day when it is shorter
// (31/1 -> 28/2 or 29/2, 31/3 -> 30/4).
export function nextMonthlyDate(anchorDate) {
  const [year, month, day] = anchorDate.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${pad(nextMonth)}-${pad(Math.min(day, daysInMonth(nextYear, nextMonth)))}`;
}

// Only money actually received counts: paid, with a real date that is not in
// the future, and not removed. Auto-created rows start unpaid and never count.
export function isReceivedPayment(payment, todayKey) {
  return (
    payment.payment_status === "paid" &&
    Boolean(payment.paid_at) &&
    payment.paid_at <= todayKey &&
    payment.notes !== REMOVED_PAYMENT_NOTE
  );
}

const DUE_SOON_DAYS = 3;

// Next expected payment of an online trainee, anchored on the latest payment
// actually received. Without one, the manual date on the profile is shown.
export function onlinePaymentState(trainee, payments, todayKey = localDateKey()) {
  if (trainee.training_type !== "אונליין") return null;

  const own = payments.filter((payment) => payment.trainee_id === trainee.id);
  const anchor = own
    .filter((payment) => isReceivedPayment(payment, todayKey))
    .reduce((latest, payment) => (!latest || payment.paid_at > latest ? payment.paid_at : latest), null);
  const hasFuturePaidAt = own.some(
    (payment) =>
      payment.payment_status === "paid" &&
      payment.paid_at > todayKey &&
      payment.notes !== REMOVED_PAYMENT_NOTE
  );

  const nextDate = anchor ? nextMonthlyDate(anchor) : trainee.next_payment_date || null;
  if (!nextDate) {
    return { source: "none", anchorDate: null, nextDate: null, daysUntil: null, status: null, hasFuturePaidAt };
  }

  const daysUntil = dayNumber(nextDate) - dayNumber(todayKey);
  const status = daysUntil < 0 ? "overdue" : daysUntil <= DUE_SOON_DAYS ? "due-soon" : "upcoming";
  return {
    source: anchor ? "calculated" : "manual",
    anchorDate: anchor,
    nextDate,
    daysUntil,
    status,
    hasFuturePaidAt,
  };
}

export function onlinePaymentText(state) {
  if (!state || !state.nextDate) return "";
  if (state.status === "overdue") return `באיחור של ${-state.daysUntil} ימים`;
  if (state.daysUntil === 0) return "היום";
  if (state.daysUntil === 1) return "מחר";
  return `בעוד ${state.daysUntil} ימים`;
}
