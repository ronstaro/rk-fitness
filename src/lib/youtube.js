// Demo videos are YouTube links. Any common link form is accepted, but only
// the video id is kept, stored as one canonical watch URL (see migration 026).

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

export function youTubeVideoId(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  let id = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, first, second] = url.pathname.split("/");
    id = first === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live"].includes(first) ? second : null;
  }

  return id && VIDEO_ID.test(id) ? id : null;
}

export function canonicalYouTubeUrl(input) {
  const id = youTubeVideoId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
