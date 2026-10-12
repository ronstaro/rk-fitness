// The public address real users must land on: invite links and the links in
// sign-up and password-reset emails. It never follows the address the admin
// happens to be using (a Vercel deployment URL may sit behind Vercel login).
const PRODUCTION_APP_URL = "https://rk-fitness-six.vercel.app";

function configuredAppUrl() {
  const value = import.meta.env.VITE_APP_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || (url.protocol === "http:" && isLocal)) return url.origin;
  } catch {
    // Fall through to the defaults below.
  }
  console.warn("VITE_APP_URL is not a valid https address; using the default.");
  return null;
}

// Production builds use the public app address even if VITE_APP_URL is
// missing; only local development falls back to the current origin.
export function appBaseUrl() {
  return (
    configuredAppUrl() ??
    (import.meta.env.PROD ? PRODUCTION_APP_URL : window.location.origin)
  );
}
