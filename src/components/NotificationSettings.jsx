import { useCallback, useEffect, useState } from "react";
import {
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  getCurrentSubscription,
  getPermission,
  getPushSupport,
  loadPushDevices,
  syncPushSubscription,
} from "../lib/pushNotifications.js";
import { sendTestPush } from "../services/pushSubscriptionsService.js";

const DESCRIPTION = "קבלי עדכון כאשר מתאמנת מסיימת אימון שמחכה לסקירה";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

// Settings card: turns push notifications on or off for this device only.
// The browser permission prompt appears only after the button is tapped.
export default function NotificationSettings() {
  const [support] = useState(() => getPushSupport());
  const [permission, setPermission] = useState(() => getPermission());
  const [enabled, setEnabled] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(support === "supported");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setPermission(getPermission());
    const subscription = await getCurrentSubscription().catch(() => null);
    if (!subscription || getPermission() !== "granted") {
      setEnabled(false);
      setDevices([]);
      return;
    }
    const { devices: list } = await loadPushDevices();
    setDevices(list);
    setEnabled(list.some((device) => device.is_current));
  }, []);

  useEffect(() => {
    if (support !== "supported") return undefined;
    let active = true;
    (async () => {
      try {
        await syncPushSubscription();
        if (active) await refresh();
      } catch (loadError) {
        console.warn("Push status load failed:", loadError?.name);
        if (active) setError("לא ניתן לבדוק כרגע את מצב ההתראות.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [support, refresh]);

  async function handleEnable() {
    setError("");
    setNotice("");
    setBusy("enable");
    try {
      const result = await enablePushOnThisDevice();
      setPermission(getPermission());
      if (result.status === "enabled") {
        await refresh();
        setNotice("ההתראות הופעלו במכשיר הזה.");
      } else if (result.status === "dismissed") {
        setError("לא אושרו התראות. אפשר לנסות שוב.");
      }
    } catch (enableError) {
      console.warn("Push enable failed:", enableError?.name);
      setError("לא ניתן להפעיל התראות כרגע. נסי שוב בעוד רגע.");
    } finally {
      setBusy("");
    }
  }

  async function handleDisable() {
    setError("");
    setNotice("");
    setBusy("disable");
    try {
      await disablePushOnThisDevice();
      await refresh();
      setNotice("ההתראות כובו במכשיר הזה.");
    } catch (disableError) {
      console.warn("Push disable failed:", disableError?.name);
      setError("לא ניתן לכבות התראות כרגע. נסי שוב.");
    } finally {
      setBusy("");
    }
  }

  async function handleTest() {
    setError("");
    setNotice("");
    setBusy("test");
    try {
      const result = await sendTestPush();
      if (result?.sent > 0) {
        setNotice("נשלחה התראת בדיקה. היא אמורה להופיע בעוד כמה שניות.");
      } else {
        setError("לא נמצא מכשיר פעיל לשליחה. נסי לכבות ולהפעיל מחדש.");
      }
      await refresh();
    } catch (testError) {
      console.warn("Push test failed:", testError?.name);
      setError("לא ניתן לשלוח התראת בדיקה כרגע.");
    } finally {
      setBusy("");
    }
  }

  let body;
  if (support === "ios-install") {
    body = (
      <>
        <div className="push-settings-steps">
          <strong>באייפון צריך קודם להוסיף את האפליקציה למסך הבית</strong>
          <ol>
            <li>לוחצים על כפתור השיתוף בספארי</li>
            <li>בוחרים "הוספה למסך הבית"</li>
            <li>פותחים את R.K Fitness מהאייקון החדש, מתחברים וחוזרים לכאן</li>
          </ol>
        </div>
        <p className="push-settings-hint">בדפדפן רגיל באייפון אין תמיכה בהתראות. זו מגבלה של אפל.</p>
      </>
    );
  } else if (support === "unsupported") {
    body = (
      <div className="push-settings-status off">
        <span className="push-settings-dot" />
        <div>
          <strong>הדפדפן הזה לא תומך בהתראות</strong>
          <span>אפשר להשתמש ב-Chrome, ב-Edge או בספארי מעודכן.</span>
        </div>
      </div>
    );
  } else if (support === "not-configured") {
    body = (
      <div className="push-settings-status off">
        <span className="push-settings-dot" />
        <div>
          <strong>ההתראות עוד לא הוגדרו</strong>
          <span>הן יהיו זמינות כאן בקרוב.</span>
        </div>
      </div>
    );
  } else if (loading) {
    body = <div className="push-settings-hint">בודקת את מצב ההתראות...</div>;
  } else if (permission === "denied") {
    body = (
      <>
        <div className="push-settings-status blocked">
          <span className="push-settings-dot" />
          <div>
            <strong>ההתראות חסומות במכשיר הזה</strong>
            <span>כדי לאפשר: הגדרות הטלפון ← התראות ← R.K Fitness ← לאפשר התראות. בדפדפן: הגדרות האתר ← התראות.</span>
          </div>
        </div>
        <button type="button" className="btn btn-outline push-settings-button" onClick={() => setPermission(getPermission())}>
          בדיקה מחדש
        </button>
      </>
    );
  } else if (enabled) {
    body = (
      <>
        <div className="push-settings-status on">
          <span className="push-settings-dot" />
          <div>
            <strong>✅ התראות פעילות</strong>
            <span>המכשיר הזה יקבל עדכונים</span>
          </div>
        </div>
        {devices.length > 0 && (
          <ul className="push-settings-devices">
            {devices.map((device) => (
              <li key={device.id}>
                <div>
                  <span>{device.device_label || "מכשיר"}</span>
                  <small>הופעל ב־{formatDate(device.created_at)}</small>
                </div>
                <span className="push-settings-tag">{device.is_current ? "המכשיר הזה" : "פעיל"}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="push-settings-actions">
          <button type="button" className="btn btn-outline push-settings-button test" disabled={Boolean(busy)} onClick={handleTest}>
            {busy === "test" ? "שולחת..." : "שליחת התראת בדיקה"}
          </button>
          <button type="button" className="btn btn-outline push-settings-button" disabled={Boolean(busy)} onClick={handleDisable}>
            {busy === "disable" ? "מכבה..." : "כיבוי התראות במכשיר הזה"}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="push-settings-status off">
          <span className="push-settings-dot" />
          <div>
            <strong>התראות כבויות</strong>
            <span>המכשיר הזה לא מקבל התראות</span>
          </div>
        </div>
        <button type="button" className="btn btn-primary push-settings-button" disabled={Boolean(busy)} onClick={handleEnable}>
          {busy === "enable" ? "מפעילה..." : "הפעלת התראות"}
        </button>
        <p className="push-settings-hint">אחרי הלחיצה הטלפון ישאל אם לאשר התראות. יש לבחור "אפשר".</p>
      </>
    );
  }

  return (
    <section className="push-settings card" aria-labelledby="push-settings-title">
      <h3 id="push-settings-title">🔔 התראות</h3>
      <p className="push-settings-description">{DESCRIPTION}</p>
      {body}
      {notice && <p className="push-settings-notice" role="status">{notice}</p>}
      {error && <p className="push-settings-error" role="alert">{error}</p>}
    </section>
  );
}
