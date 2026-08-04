import { supabase } from "../lib/supabase.js";
import { getBusinessOwnerId } from "./accessService.js";

function leadPayload(input) {
  return {
    full_name: input.full_name,
    phone: input.phone,
    email: input.email ?? null,
    gender: input.gender ?? null,
    birth_date: input.birth_date ?? null,
    source: input.source,
    custom_source: input.custom_source ?? null,
    referral_name: input.referral_name ?? null,
    status: input.status,
    follow_up_date: input.follow_up_date ?? null,
    goal: input.goal ?? null,
    experience_level: input.experience_level ?? null,
    service_type: input.service_type ?? null,
    location: input.location ?? null,
    availability: input.availability ?? null,
    health_declaration_status: input.health_declaration_status ?? null,
    notes: input.notes ?? null,
  };
}

export async function fetchLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createLead(input) {
  const ownerId = await getBusinessOwnerId();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      owner_id: ownerId,
      ...leadPayload(input),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id, input) {
  const { data, error } = await supabase
    .from("leads")
    .update(leadPayload(input))
    .eq("id", id)
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

export async function convertLeadToTrainee(id, trainingType, startDate) {
  const { data, error } = await supabase.rpc("convert_lead_to_trainee", {
    p_lead_id: id,
    p_training_type: trainingType,
    p_start_date: startDate,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
