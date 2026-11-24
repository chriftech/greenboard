/**
 * Which board columns are collapsed into a slim strip, saved in this browser (localStorage).
 * Read with useCollapsedColumns(); change with setColumnCollapsed().
 */

import { useSyncExternalStore } from "react";

const KEY = "greenboard.collapsed-columns.v1";
const EMPTY: readonly string[] = [];

let cached: readonly string[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly string[] {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : [];
  } catch {
    // Storage blocked or unreadable: nothing collapsed.
    cached = [];
  }
  return cached;
}

export function setColumnCollapsed(id: string, collapsed: boolean) {
  const now = read();
  if (now.includes(id) === collapsed) return;
  cached = collapsed ? [...now, id] : now.filter((x) => x !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Storage blocked: the change still applies for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other open tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The ids of the collapsed columns. The server (and the first render) shows them all open. */
export function useCollapsedColumns(): readonly string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
