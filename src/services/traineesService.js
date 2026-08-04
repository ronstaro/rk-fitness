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

export async function deleteTrainee(id) {
  const { data, error } = await supabase
    .from("trainees")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("המתאמן לא נמצא או שאין הרשאה למחוק אותו");
  return data;
}
