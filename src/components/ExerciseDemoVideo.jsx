import { useEffect, useState } from "react";
import { getExerciseDemoVideoUrl } from "../services/programsService.js";
import { canonicalYouTubeUrl } from "../lib/youtube.js";

// Opens the trainer's demo video for one exercise. A YouTube link opens on
// YouTube in a new tab. An older uploaded file plays here; its private link is
// only requested when the button is pressed and expires after an hour.
export default function ExerciseDemoVideo({ url: youTubeUrl, path, exerciseName, label = "▶ צפייה בסרטון הדגמה", className = "btn btn-outline btn-sm", style }) {
  const youTubeLink = canonicalYouTubeUrl(youTubeUrl);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function show() {
    setOpen(true);
    setError("");
    setUrl("");
    setLoading(true);
    try {
      setUrl(await getExerciseDemoVideoUrl(path));
    } catch (loadError) {
      console.error("Demo video link error:", loadError);
      setError("לא ניתן לפתוח את הסרטון כרגע. נסו שוב.");
    } finally {
      setLoading(false);
    }
  }

  if (youTubeLink) {
    return (
      <a className={className} style={style} href={youTubeLink} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }

  if (!path) return null;

  return (
    <>
      <button type="button" className={className} style={style} onClick={show}>
        {label}
      </button>
      {open && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="modal demo-video-modal" role="dialog" aria-modal="true" aria-label={`סרטון הדגמה: ${exerciseName}`}>
            <div className="demo-video-head">
              <div className="modal-title">{exerciseName}</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="סגירה">✕</button>
            </div>
            {loading && <div className="text-sm muted">טוען סרטון…</div>}
            {error && <div className="demo-video-error">{error}</div>}
            {url && (
              <video className="demo-video-player" src={url} controls playsInline preload="metadata" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
