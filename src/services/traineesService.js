import { supabase } from "../lib/supabase.js";

export async function fetchTrainees() {
  const { data, error } = await supabase
    .from("trainees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTrainee(input) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("לא ניתן לקבל את פרטי המשתמש המחובר");
  }

  const { data, error } = await supabase
    .from("trainees")
    .insert({
      owner_id: user.id,
      full_name: input.full_name,
      phone: input.phone,
      birth_date: input.birth_date ?? null,
      start_date: input.start_date,
      training_type: input.training_type,
      status: input.status,
      main_goal: input.main_goal,
      success_metric: input.success_metric ?? null,
      notes: input.notes ?? null,
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
  const { error } = await supabase
    .from("trainees")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
