// push-test: sends one fixed test notification to the calling admin's own
// devices. Deployed with JWT verification on (the default).
//
// Takes no input. The recipient is the verified caller, the text is fixed
// here, and the targets come from public.push_targets_for_member, which only
// returns devices of an active admin. Nothing private is logged.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
// Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional: PUSH_ALLOWED_ORIGINS (comma separated).

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const DEFAULT_ORIGINS = ["https://rk-fitness-six.vercel.app", "http://localhost:5173"];
const ALLOWED_ORIGINS = (Deno.env.get("PUSH_ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const TEST_MESSAGE = JSON.stringify({
  title: "התראת בדיקה ✅",
  body: "ההתראות פועלות במכשיר הזה",
  url: "/",
  tag: "rk-test",
});

type Target = { id: string; endpoint: string; p256dh: string; auth_secret: string };
type Outcome = "ok" | "gone" | "error";

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function outcomeFor(statusCode: number | undefined): Outcome {
  if (statusCode && statusCode >= 200 && statusCode < 300) return "ok";
  if (statusCode === 404 || statusCode === 410) return "gone";
  return "error";
}

function hostOf(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "invalid";
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    console.error(JSON.stringify({ fn: "push-test", error: "vapid_not_configured" }));
    return json({ error: "not_configured" }, 503, origin);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const memberId = userData?.user?.id;
  if (userError || !memberId) return json({ error: "unauthorized" }, 401, origin);

  // Empty for anyone who is not an active admin, so trainees reach nothing.
  const { data: targets, error: targetsError } = await admin.rpc("push_targets_for_member", {
    p_member_id: memberId,
  });
  if (targetsError) {
    console.error(JSON.stringify({ fn: "push-test", member: memberId, error: "targets_failed" }));
    return json({ error: "server_error" }, 500, origin);
  }

  const list = (targets ?? []) as Target[];
  if (list.length === 0) return json({ targeted: 0, sent: 0, failed: 0 }, 200, origin);

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const results = await Promise.all(
    list.map(async (target) => {
      try {
        const response = await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth_secret } },
          TEST_MESSAGE,
          { TTL: 60, urgency: "high", timeout: 10000 },
        );
        return { id: target.id, outcome: outcomeFor(response.statusCode), code: response.statusCode, host: hostOf(target.endpoint) };
      } catch (error) {
        const code = (error as { statusCode?: number })?.statusCode;
        return { id: target.id, outcome: outcomeFor(code), code: code ?? 0, host: hostOf(target.endpoint) };
      }
    }),
  );

  const { error: recordError } = await admin.rpc("record_push_results", {
    p_results: results.map(({ id, outcome }) => ({ id, outcome })),
  });

  const sent = results.filter((result) => result.outcome === "ok").length;
  console.log(JSON.stringify({
    fn: "push-test",
    member: memberId,
    targeted: list.length,
    sent,
    failed: list.length - sent,
    codes: results.map((result) => result.code),
    hosts: results.map((result) => result.host),
    recorded: !recordError,
  }));

  return json({ targeted: list.length, sent, failed: list.length - sent }, 200, origin);
});
