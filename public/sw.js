// R.K Fitness service worker: push notifications only.
//
// There is deliberately no fetch handler and no cache, so this worker can
// never serve an old version of the app after a deploy. If it ever has to be
// removed from every device, replace this file with one that calls
// self.registration.unregister() in its activate event.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Only same-origin targets are opened from a notification.
function safeUrl(value) {
  try {
    const url = new URL(value || "/", self.location.origin);
    if (url.origin === self.location.origin) return url.href;
  } catch {
    // Fall through to the home page.
  }
  return new URL("/", self.location.origin).href;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = typeof data.title === "string" && data.title ? data.title : "R.K Fitness";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    lang: "he",
    dir: "rtl",
    data: { url: safeUrl(data.url) },
  };
  if (typeof data.tag === "string" && data.tag) options.tag = data.tag;

  // Every push must show a notification, or iOS drops the subscription.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data?.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        client.postMessage({ type: "rk-notification-click", url });
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
