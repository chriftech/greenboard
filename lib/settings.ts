/**
 * Board preferences, saved in this browser (localStorage) like the tasks.
 * Read them with useSettings(); change one with setSetting().
 */

import { useSyncExternalStore } from "react";

export type Settings = {
  /** The "Good morning" card at the top of the board, with the date and progress ring. */
  showGreeting: boolean;
};

export const DEFAULT_SETTINGS: Settings = { showGreeting: true };

const SETTINGS_KEY = "greenboard.settings.v1";

let cached: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cached) return cached;
  let saved: Partial<Settings> = {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    // Storage blocked or unreadable: use the defaults.
  }
  cached = {
    showGreeting: typeof saved.showGreeting === "boolean" ? saved.showGreeting : DEFAULT_SETTINGS.showGreeting,
  };
  return cached;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  cached = { ...read(), [key]: value };
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(cached));
  } catch {
    // Storage blocked: the change still applies for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other open tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== SETTINGS_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current settings. The server (and the first render) uses the defaults. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
}
