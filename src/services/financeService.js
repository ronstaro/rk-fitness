import { supabase } from "../lib/supabase.js";

const DEFAULT_SETTINGS = {
  vat_rate: 18,
  income_tax_rate: 0,
  prices_include_vat: true,
};

const REMOVED_PAYMENT_NOTE = "__removed_by_admin__";

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("לא ניתן לקבל את פרטי המשתמש המחובר");
  }

  return user.id;
}

function addMonths(monthStart, amount) {
  const [year, month] = monthStart.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

async function ensureMonthlyPayments(ownerId, monthStart, trainees, payments) {
  const existingTraineeIds = new Set(payments.map((payment) => payment.trainee_id));
  const missingPayments = trainees
    .filter((trainee) => !existingTraineeIds.has(trainee.id))
    .map((trainee) => ({
      owner_id: ownerId,
      trainee_id: trainee.id,
      billing_month: monthStart,
      trainee_name: trainee.full_name,
      package_name: trainee.package_name ?? null,
      amount: Number(trainee.package_price ?? 0),
      payment_method: trainee.payment_method ?? null,
      payment_status: "paid",
      paid_at: localDateKey(),
    }));

  if (missingPayments.length === 0) return payments;

  const { error } = await supabase
    .from("trainee_monthly_payments")
    .upsert(missingPayments, {
      onConflict: "owner_id,trainee_id,billing_month",
      ignoreDuplicates: true,
    });

  if (error) throw error;

  const { data, error: fetchError } = await supabase
    .from("trainee_monthly_payments")
    .select("*")
    .eq("billing_month", monthStart)
    .order("trainee_name", { ascending: true });

  if (fetchError) throw fetchError;
  return data;
}

export async function fetchFinanceData(monthStart) {
  const ownerId = await getCurrentUserId();
  const trendStart = addMonths(monthStart, -11);
  const currentMonth = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}-01`;

  const [traineesResult, paymentsResult, expensesResult, settingsResult, trendResult] =
    await Promise.all([
      supabase
        .from("trainees")
        .select("id, full_name, status, package_name, package_price, payment_method")
        .eq("status", "פעיל")
        .order("full_name", { ascending: true }),
      supabase
        .from("trainee_monthly_payments")
        .select("*")
        .eq("billing_month", monthStart)
        .order("trainee_name", { ascending: true }),
      supabase
        .from("finance_expenses")
        .select("*")
        .eq("billing_month", monthStart)
        .order("expense_date", { ascending: false }),
      supabase.from("finance_settings").select("*").maybeSingle(),
      supabase
        .from("trainee_monthly_payments")
        .select("billing_month, amount, notes")
        .gte("billing_month", trendStart)
        .lte("billing_month", monthStart),
    ]);

  for (const result of [
    traineesResult,
    paymentsResult,
    expensesResult,
    settingsResult,
    trendResult,
  ]) {
    if (result.error) throw result.error;
  }

  let settings = settingsResult.data;
  if (!settings) {
    const { data, error } = await supabase
      .from("finance_settings")
      .upsert({ owner_id: ownerId, ...DEFAULT_SETTINGS })
      .select()
      .single();
    if (error) throw error;
    settings = data;
  }

  const ensuredPayments =
    monthStart === currentMonth
      ? await ensureMonthlyPayments(
          ownerId,
          monthStart,
          traineesResult.data,
          paymentsResult.data
        )
      : paymentsResult.data;
  const payments = ensuredPayments.filter(
    (payment) => payment.notes !== REMOVED_PAYMENT_NOTE
  );

  let trendPayments = trendResult.data.filter(
    (payment) => payment.notes !== REMOVED_PAYMENT_NOTE
  );
  if (ensuredPayments.length !== paymentsResult.data.length) {
    trendPayments = trendPayments
      .filter((payment) => payment.billing_month !== monthStart)
      .concat(
        payments.map((payment) => ({
          billing_month: payment.billing_month,
          amount: payment.amount,
        }))
      );
  }

  return {
    activeTrainees: traineesResult.data,
    payments,
    expenses: expensesResult.data,
    settings,
    trendPayments,
  };
}

export async function updateMonthlyPayment(id, paymentStatus) {
  const { data, error } = await supabase
    .from("trainee_monthly_payments")
    .update({
      payment_status: paymentStatus,
      paid_at: paymentStatus === "paid" ? localDateKey() : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createMonthlyPayment(input) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("trainee_monthly_payments")
    .insert({
      owner_id: ownerId,
      trainee_id: input.trainee_id || null,
      billing_month: input.billing_month,
      trainee_name: input.trainee_name,
      package_name: input.package_name || null,
      amount: input.amount,
      payment_method: input.payment_method || null,
      payment_status: input.payment_status,
      paid_at: input.payment_status === "paid" ? input.paid_at : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMonthlyPaymentDetails(id, input) {
  const { data, error } = await supabase
    .from("trainee_monthly_payments")
    .update({
      trainee_id: input.trainee_id || null,
      trainee_name: input.trainee_name,
      package_name: input.package_name || null,
      amount: input.amount,
      payment_method: input.payment_method || null,
      payment_status: input.payment_status,
      paid_at: input.payment_status === "paid" ? input.paid_at : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMonthlyPayment(payment) {
  const query = supabase.from("trainee_monthly_payments");
  const { error } = payment.trainee_id
    ? await query.update({ notes: REMOVED_PAYMENT_NOTE }).eq("id", payment.id)
    : await query.delete().eq("id", payment.id);

  if (error) throw error;
}

export async function createFinanceExpense(input) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("finance_expenses")
    .insert({
      owner_id: ownerId,
      billing_month: input.billing_month,
      expense_date: input.expense_date,
      category: input.category,
      description: input.description || null,
      amount: input.amount,
      is_recognized: input.is_recognized,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFinanceExpense(id, input) {
  const { data, error } = await supabase
    .from("finance_expenses")
    .update({
      expense_date: input.expense_date,
      category: input.category,
      description: input.description || null,
      amount: input.amount,
      is_recognized: input.is_recognized,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFinanceExpense(id) {
  const { error } = await supabase.from("finance_expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function updateFinanceSettings(input) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("finance_settings")
    .upsert({
      owner_id: ownerId,
      vat_rate: input.vat_rate,
      income_tax_rate: input.income_tax_rate,
      prices_include_vat: input.prices_include_vat,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
