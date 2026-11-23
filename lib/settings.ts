/**
 * Board preferences, saved in this browser (localStorage) like the tasks.
 * Read them with useSettings(); change one with setSetting().
 */

import { useSyncExternalStore } from "react";

/** How many minutes before a task starts its reminder shows (0 = when it starts). */
export const REMINDER_LEADS = [0, 5, 10, 15, 30, 60] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

export type Settings = {
  /** The "Good morning" card at the top of the board, with the date and progress ring. */
  showGreeting: boolean;
  /** Browser notifications before scheduled tasks start (also needs the browser's permission). */
  reminders: boolean;
  reminderLead: ReminderLead;
};

export const DEFAULT_SETTINGS: Settings = { showGreeting: true, reminders: false, reminderLead: 10 };

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
    reminders: typeof saved.reminders === "boolean" ? saved.reminders : DEFAULT_SETTINGS.reminders,
    reminderLead: (REMINDER_LEADS as readonly number[]).includes(saved.reminderLead as number)
      ? (saved.reminderLead as ReminderLead)
      : DEFAULT_SETTINGS.reminderLead,
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

/** The current settings, outside React (e.g. in timers). */
export function getSettings(): Settings {
  return read();
}

/** The current settings. The server (and the first render) uses the defaults. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
}
