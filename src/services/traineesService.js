import { supabase } from "../lib/supabase.js";
import { getBusinessOwnerId } from "./accessService.js";

export async function fetchTrainees() {
  const { data, error } = await supabase
    .from("trainees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTrainee(input) {
  const ownerId = await getBusinessOwnerId();

  const { data, error } = await supabase
    .from("trainees")
    .insert({
      owner_id: ownerId,
      full_name: input.full_name,
      phone: input.phone,
      birth_date: input.birth_date ?? null,
      start_date: input.start_date,
      training_type: input.training_type,
      status: input.status,
      main_goal: input.main_goal,
      success_metric: input.success_metric ?? null,
      notes: input.notes ?? null,
      package_name: input.package_name ?? null,
      package_price: input.package_price ?? null,
      payment_method: input.payment_method ?? null,
      payment_status: input.payment_status ?? null,
      next_payment_date: input.next_payment_date ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTrainee(id, input) {
  const { data, error } = await supabase
    .from("trainees")
    .update({
      full_name: input.full_name,
      phone: input.phone,
      birth_date: input.birth_date ?? null,
      start_date: input.start_date,
      training_type: input.training_type,
      status: input.status,
      main_goal: input.main_goal,
      success_metric: input.success_metric ?? null,
      notes: input.notes ?? null,
      package_name: input.package_name ?? null,
      package_price: input.package_price ?? null,
      payment_method: input.payment_method ?? null,
      payment_status: input.payment_status ?? null,
      next_payment_date: input.next_payment_date ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTraineeStatus(id, status) {
  const { data, error } = await supabase
    .from("trainees")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Deletes the trainee, its cascaded data and its linked login account (if
// any) in one server-side transaction. Only the trainee id is sent; the
// database looks up and validates the linked account itself.
export async function deleteTrainee(id) {
  const { data, error } = await supabase.rpc("delete_trainee_completely", {
    p_trainee_id: id,
  });

  if (error) throw error;
  return data;
}

// Maps the fixed messages raised by delete_trainee_completely to Hebrew UI
// text. Anything else falls back to a generic message.
const DELETE_TRAINEE_ERROR_MESSAGES = {
  "Admin access required": "אין הרשאה למחוק מתאמנים.",
  "Trainee not found": "המתאמן לא נמצא או שכבר נמחק.",
  "Cannot delete own account": "המתאמן מקושר לחשבון שלך, ולכן לא ניתן למחוק אותו כאן.",
  "Linked account is not a trainee account": "המתאמן מקושר לחשבון ניהול, ולכן המחיקה נעצרה. לא נמחק דבר.",
  "Linked account is inconsistent": "נמצאה בעיה בקישור החשבון של המתאמן, ולכן המחיקה נעצרה. לא נמחק דבר.",
  "Linked account not found": "לא ניתן למחוק את חשבון ההתחברות של המתאמן. לא נמחק דבר.",
};

export function deleteTraineeErrorMessage(error) {
  return DELETE_TRAINEE_ERROR_MESSAGES[error?.message] ?? "לא ניתן למחוק את המתאמן כרגע. לא נמחק דבר, נסה שוב.";
}
