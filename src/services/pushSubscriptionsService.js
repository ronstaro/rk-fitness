import { supabase } from "../lib/supabase.js";

// Push devices (migration 030). The table itself is closed to the app; these
// RPCs act only for the signed-in admin and never return push keys.

export async function registerPushSubscription({ endpoint, p256dh, authSecret, deviceLabel }) {
  const { data, error } = await supabase.rpc("register_my_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth_secret: authSecret,
    p_device_label: deviceLabel ?? null,
  });
  if (error) throw error;
  return data;
}

export async function revokePushSubscription(endpoint) {
  const { data, error } = await supabase.rpc("revoke_my_push_subscription", {
    p_endpoint: endpoint,
  });
  if (error) throw error;
  return data === true;
}

export async function fetchMyPushDevices(currentEndpoint) {
  const { data, error } = await supabase.rpc("list_my_push_devices", {
    p_current_endpoint: currentEndpoint,
  });
  if (error) throw error;
  return data ?? [];
}

// Sends a fixed test notification to the caller's own devices only. The
// Edge Function takes no input: who, what and where all come from the server.
export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke("push-test", { body: {} });
  if (error) throw error;
  return data;
}
