import { supabase } from "../lib/supabase.js";

export async function fetchDashboardPayments(monthStart) {
  const { data, error } = await supabase
    .from("trainee_monthly_payments")
    .select("id, trainee_id, trainee_name, amount, payment_status, paid_at, notes")
    .eq("billing_month", monthStart)
    .or("notes.is.null,notes.neq.__removed_by_admin__")
    .order("trainee_name", { ascending: true });

  if (error) throw error;
  return data;
}
