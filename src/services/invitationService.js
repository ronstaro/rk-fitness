import { supabase } from "../lib/supabase.js";

// The token travels in the URL fragment so it is never sent to the server
// in request logs or Referer headers.
export function buildInviteLink(token) {
  return `${window.location.origin}/#invite=${encodeURIComponent(token)}`;
}

export async function createTraineeInvite(traineeId) {
  const { data: token, error } = await supabase.rpc("create_trainee_invite", {
    p_trainee_id: traineeId,
  });

  if (error) throw error;
  return { token, link: buildInviteLink(token) };
}

export async function getTraineeInviteStatus(traineeId) {
  const { data, error } = await supabase
    .rpc("get_trainee_invite_status", { p_trainee_id: traineeId })
    .maybeSingle();

  if (error) throw error;
  return data ?? { status: "none", created_at: null, expires_at: null, used_at: null };
}

export async function revokeTraineeInvite(traineeId) {
  const { data, error } = await supabase.rpc("revoke_trainee_invite", {
    p_trainee_id: traineeId,
  });

  if (error) throw error;
  return data;
}

export async function acceptTraineeInvite(token) {
  const { data, error } = await supabase.rpc("accept_trainee_invite", {
    p_token: token,
  });

  if (error) throw error;
  return data;
}
