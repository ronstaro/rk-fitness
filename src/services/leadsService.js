import { supabase } from "../lib/supabase.js";

export async function fetchLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createLead(input) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("לא ניתן לקבל את פרטי המשתמש המחובר");

  const { data, error } = await supabase
    .from("leads")
    .insert({
      owner_id:        user.id,
      full_name:       input.full_name,
      phone:           input.phone,
      source:          input.source,
      custom_source:   input.custom_source   ?? null,
      status:          input.status,
      follow_up_date:  input.follow_up_date  ?? null,
      notes:           input.notes           ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLeadStatus(id, status) {
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id) {
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
