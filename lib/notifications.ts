/**
 * Task reminders as browser notifications (the Notifications API, no server involved).
 *
 * A task with a timeline gets one reminder, `lead` minutes before it starts (Settings).
 * Reminders only show while Greenboard is open in a tab, and only when the user has
 * turned them on and the browser has given permission.
 */

import { useSyncExternalStore } from "react";
import type { Task } from "./tasks";

export type NotificationState = NotificationPermission | "unsupported";

const supported = () => typeof window !== "undefined" && "Notification" in window;

/** Whether this browser can show notifications, and if so what the user has allowed. */
export function getNotificationState(): NotificationState {
  return supported() ? Notification.permission : "unsupported";
}

const permissionListeners = new Set<() => void>();
const notifyPermission = () => permissionListeners.forEach((l) => l());

function subscribePermission(listener: () => void) {
  permissionListeners.add(listener);
  // Permission can also change from the browser's site settings: check again when the
  // tab comes back, and listen for the change where the Permissions API reports it.
  const onVisible = () => document.visibilityState === "visible" && listener();
  document.addEventListener("visibilitychange", onVisible);
  let status: PermissionStatus | null = null;
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((s) => {
      status = s;
      s.addEventListener("change", listener);
    })
    .catch(() => {});
  return () => {
    permissionListeners.delete(listener);
    document.removeEventListener("visibilitychange", onVisible);
    status?.removeEventListener("change", listener);
  };
}

/** The notification permission, kept up to date. The server assumes "default". */
export function useNotificationState(): NotificationState {
  return useSyncExternalStore(subscribePermission, getNotificationState, () => "default");
}

/** Ask the browser for permission (it only shows its prompt while the answer is "default"). */
export async function requestNotificationPermission(): Promise<NotificationState> {
  if (!supported()) return "unsupported";
  const result = await Notification.requestPermission();
  notifyPermission();
  return result;
}

/* ───────────────────────── When reminders are due ───────────────────────── */

/** A reminder missed while no Greenboard tab was open still shows if it's at most this late. */
export const REMINDER_GRACE_MS = 15 * 60_000;

const MINUTE = 60_000;

/** Local "YYYY-MM-DDTHH:mm" to a timestamp. */
const toTime = (local: string) => new Date(local).getTime();

/** One reminder per task and start time: moving the start gives it a fresh reminder. */
export const reminderKey = (t: Pick<Task, "id" | "start">) => `${t.id}@${t.start}`;

export type DueReminder = { task: Task; key: string; startsAt: number };

/**
 * The reminders that should show now: tasks with a timeline, not ticked or in Trash, whose
 * reminder time has passed by no more than the grace period, and that haven't been sent.
 */
export function dueReminders(
  tasks: readonly Task[],
  { now, leadMinutes, sent, ticked }: { now: number; leadMinutes: number; sent: ReadonlySet<string>; ticked: (t: Task) => boolean },
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const task of tasks) {
    if (!task.start || !task.end || task.deletedAt !== undefined || ticked(task)) continue;
    const startsAt = toTime(task.start);
    const remindAt = startsAt - leadMinutes * MINUTE;
    if (Number.isNaN(startsAt) || now < remindAt || now > remindAt + REMINDER_GRACE_MS || now > toTime(task.end)) continue;
    const key = reminderKey(task);
    if (!sent.has(key)) due.push({ task, key, startsAt });
  }
  return due;
}

/** The next moment a reminder becomes due (for scheduling the next check), or null. */
export function nextReminderAt(tasks: readonly Task[], { now, leadMinutes }: { now: number; leadMinutes: number }) {
  let next: number | null = null;
  for (const task of tasks) {
    if (!task.start || task.deletedAt !== undefined) continue;
    const remindAt = toTime(task.start) - leadMinutes * MINUTE;
    if (remindAt > now && (next === null || remindAt < next)) next = remindAt;
  }
  return next;
}

/* ───────────────────────── Which reminders were sent ───────────────────────── */

/**
 * Sent reminders are remembered in this browser, so a reload or a second tab doesn't
 * repeat them. Entries older than two days are dropped.
 */
const SENT_KEY = "greenboard.reminders.sent.v1";
const KEEP_MS = 2 * 24 * 60 * MINUTE;

function readSent(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** The keys of reminders already shown (read fresh, so other tabs' sends count). */
export function getSentReminders(): Set<string> {
  return new Set(Object.keys(readSent()));
}

export function markRemindersSent(keys: readonly string[], now = Date.now()) {
  const kept = Object.fromEntries(Object.entries(readSent()).filter(([, at]) => now - at < KEEP_MS));
  keys.forEach((k) => (kept[k] = now));
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify(kept));
  } catch {
    // Storage blocked: reminders may repeat after a reload, but still show.
  }
}

/* ───────────────────────── Showing one ───────────────────────── */

const timeOf = (local: string) =>
  new Date(local).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** The notification's second line: when the task starts, relative to now. */
export function reminderBody(task: Pick<Task, "start" | "end">, now = Date.now()): string {
  const range = `${timeOf(task.start!)} – ${timeOf(task.end!)}`;
  const minutes = Math.round((toTime(task.start!) - now) / MINUTE);
  if (minutes >= 60 && minutes % 60 === 0) return `Starts in ${minutes / 60} hour${minutes === 60 ? "" : "s"} · ${range}`;
  if (minutes >= 1) return `Starts in ${minutes} minute${minutes === 1 ? "" : "s"} · ${range}`;
  if (minutes >= -1) return `Starting now · ${range}`;
  return `Started ${-minutes} minutes ago · ${range}`;
}

/**
 * Show a notification. Clicking it brings the tab forward and calls `onClick`.
 * Returns false when the browser can't show one this way (e.g. Chrome on Android,
 * which only allows notifications from a service worker).
 */
export function showNotification(title: string, { body, tag, onClick }: { body: string; tag: string; onClick?: () => void }) {
  if (getNotificationState() !== "granted") return false;
  try {
    const n = new Notification(title, { body, tag, icon: "/favicon.ico" });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
