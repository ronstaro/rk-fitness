// External demo-video links (YouTube, Instagram, TikTok, Vimeo, Drive, ...).
// Any https page is accepted; the link is stored as the browser normalizes
// it, which also satisfies the database check from migration 028.

const MAX_LENGTH = 2000;

export function normalizeVideoLink(input) {
  let text = String(input ?? "").trim();
  if (!text || /\s/.test(text)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;

  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  // Old http links are upgraded; any other scheme (javascript:, data:, ...) is refused.
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return null;

  const href = url.href;
  return href.length <= MAX_LENGTH ? href : null;
}
