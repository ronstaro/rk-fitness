import { useEffect, useState } from "react";

// Remembers where the user was in this browser tab, so a reload or a tab the
// browser discarded in the background reopens the same screen. It holds view
// names and record ids only, never form contents, and lives in sessionStorage
// so it ends with the tab and is cleared on sign-out.
const PREFIX = "rk-nav:";
const OWNER_KEY = `${PREFIX}owner`;

function getStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function navigationKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

export function clearNavigationMemory(scope = "") {
  const storage = getStorage();
  if (!storage) return;
  try {
    const prefix = `${PREFIX}${scope}`;
    for (const key of navigationKeys(storage)) {
      if (key.startsWith(prefix)) storage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode, quota); memory is optional.
  }
}

// Drops anything remembered for a different account before it can be restored.
export function claimNavigationMemory(userId) {
  const storage = getStorage();
  if (!storage || !userId) return;
  try {
    if (storage.getItem(OWNER_KEY) !== userId) {
      clearNavigationMemory();
      storage.setItem(OWNER_KEY, userId);
    }
  } catch {
    // See clearNavigationMemory.
  }
}

export function readNavigation(key, fallback, isValid = () => true) {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(`${PREFIX}${key}`);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeNavigation(key, value) {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (value === "" || value === null || value === undefined) {
      storage.removeItem(`${PREFIX}${key}`);
    } else {
      storage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    }
  } catch {
    // See clearNavigationMemory.
  }
}

export function useRememberedState(key, initialValue, isValid) {
  const [value, setValue] = useState(() => {
    const fallback = typeof initialValue === "function" ? initialValue() : initialValue;
    return readNavigation(key, fallback, isValid);
  });

  useEffect(() => {
    writeNavigation(key, value);
  }, [key, value]);

  return [value, setValue];
}
