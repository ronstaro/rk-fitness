// Web Push on this device: service worker registration, support detection,
// permission and subscription. The server side (who receives what) lives in
// migration 030 and the push-test Edge Function.

import {
  fetchMyPushDevices,
  registerPushSubscription,
  revokePushSubscription,
} from "../services/pushSubscriptionsService.js";

const SW_URL = "/sw.js";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch((error) => {
      console.warn("Service worker registration failed:", error?.name);
    });
  });
}

function isIos() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

// "supported" | "ios-install" | "unsupported" | "not-configured"
export function getPushSupport() {
  if (typeof window === "undefined" || !window.isSecureContext) return "unsupported";
  // On iPhone/iPad push exists only in the Home Screen app, never in a tab.
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  return "supported";
}

export function getPermission() {
  return "Notification" in window ? Notification.permission : "default";
}

export function deviceLabel() {
  const ua = navigator.userAgent || "";
  let device = "מחשב";
  if (/iPhone|iPod/.test(ua)) device = "אייפון";
  else if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) device = "אייפד";
  else if (/Android/.test(ua)) device = "אנדרואיד";
  else if (/Macintosh/.test(ua)) device = "מק";

  let browser = "דפדפן";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return `${device} · ${isStandalone() ? "מסך הבית" : browser}`;
}

function base64UrlToBytes(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function sameKey(buffer, expected) {
  if (!buffer) return false;
  const actual = new Uint8Array(buffer);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function getCurrentSubscription() {
  if (getPushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

async function saveSubscription(subscription) {
  const { endpoint, keys } = subscription.toJSON();
  await registerPushSubscription({
    endpoint,
    p256dh: keys?.p256dh,
    authSecret: keys?.auth,
    deviceLabel: deviceLabel(),
  });
  return endpoint;
}

// Must run straight from the button tap: the permission prompt needs a user
// gesture, so it is the first thing awaited here.
export async function enablePushOnThisDevice() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: permission === "denied" ? "denied" : "dismissed" };

  const registration = await getRegistration();
  await navigator.serviceWorker.ready;

  const serverKey = base64UrlToBytes(VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with an older server key can no longer receive pushes.
  if (subscription && !sameKey(subscription.options?.applicationServerKey, serverKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: serverKey,
    });
  }

  const endpoint = await saveSubscription(subscription);
  return { status: "enabled", endpoint };
}

// Stops pushes to this device: the server row first, then the browser
// subscription. Once unsubscribed the push service rejects further sends, so
// the device is safe even if the server call failed.
export async function disablePushOnThisDevice() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  let serverError = null;
  try {
    await revokePushSubscription(subscription.endpoint);
  } catch (error) {
    serverError = error;
  }
  await subscription.unsubscribe();
  if (serverError) console.warn("Push revoke failed:", serverError?.name);
}

// Re-saves an existing subscription (keys can rotate, the server may have
// dropped it). Never asks for permission and never creates a subscription.
export async function syncPushSubscription() {
  if (getPushSupport() !== "supported" || getPermission() !== "granted") return null;
  const subscription = await getCurrentSubscription();
  if (!subscription) return null;
  return saveSubscription(subscription);
}

export async function loadPushDevices() {
  const subscription = await getCurrentSubscription().catch(() => null);
  const devices = await fetchMyPushDevices(subscription?.endpoint ?? null);
  return { devices, currentEndpoint: subscription?.endpoint ?? null };
}

// Used on sign-out so a shared device stops receiving business notifications.
// Bounded so it can never hold up logging out.
export async function disablePushOnSignOut(timeoutMs = 2500) {
  if (getPushSupport() !== "supported") return;
  await Promise.race([
    disablePushOnThisDevice().catch((error) => console.warn("Push sign-out cleanup failed:", error?.name)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
