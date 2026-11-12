/**
 * The board's guided tour: whether it's running, and whether this browser has
 * already seen it (so it only starts by itself on a first visit).
 */

import { useSyncExternalStore } from "react";

const KEY = "greenboard.tour.v1";

let running = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True once the tour has been finished or skipped in this browser. */
export function hasSeenTour() {
  try {
    return window.localStorage.getItem(KEY) === "done";
  } catch {
    return true; // Storage blocked: don't keep popping up every visit.
  }
}

export const tourActions = {
  start() {
    if (running) return;
    running = true;
    emit();
  },
  /** Finished or skipped: either way, don't start by itself again. */
  end() {
    try {
      window.localStorage.setItem(KEY, "done");
    } catch {
      // Storage blocked: it may show again next visit.
    }
    running = false;
    emit();
  },
};

export function useTourRunning() {
  return useSyncExternalStore(
    subscribe,
    () => running,
    () => false,
  );
}
