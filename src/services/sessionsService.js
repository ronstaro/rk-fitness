import { supabase } from "../lib/supabase.js";
import { getBusinessOwnerId } from "./accessService.js";

export async function fetchSessions() {
  const { data, error } = await supabase
    .from("training_sessions")
    .select("*")
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createSession(input) {
  const ownerId = await getBusinessOwnerId();

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({
      owner_id: ownerId,
      trainee_id: input.traineeId,
      session_date: input.date,
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      training_type: input.trainingType,
      location: input.location,
      status: input.status,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSession(id, input) {
  const { data, error } = await supabase
    .from("training_sessions")
    .update({
      trainee_id: input.traineeId,
      session_date: input.date,
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      training_type: input.trainingType,
      location: input.location,
      status: input.status,
      notes: input.notes ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSessionStatus(id, status) {
  const { data, error } = await supabase
    .from("training_sessions")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSession(id) {
  const { error } = await supabase
    .from("training_sessions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
