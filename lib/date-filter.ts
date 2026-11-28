/**
 * The board's date filter: show tasks whose timeline falls in a range of days.
 * Presets (Today, This week, …) are worked out when the board renders, so they
 * stay right as the days pass; a custom range is fixed dates.
 *
 * A task matches when its timeline overlaps the range at all, so a task running
 * Monday to Friday shows for "Today" on Wednesday. Tasks without a timeline only
 * show for "No date".
 */

import { todayKey } from "./tasks";

export type DatePreset = "today" | "tomorrow" | "week" | "next7" | "month";

export type DateFilter =
  | { kind: "any" }
  /** Tasks with no timeline. */
  | { kind: "none" }
  | { kind: "preset"; preset: DatePreset }
  /** "YYYY-MM-DD" days, both included. */
  | { kind: "range"; from: string; to: string };

export const ANY_DATE: DateFilter = { kind: "any" };

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
  { id: "next7", label: "Next 7 days" },
  { id: "month", label: "This month" },
];

const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

/** The days a filter covers, or null for "any" and "none". */
export function dateRangeOf(filter: DateFilter, now = new Date()): { from: string; to: string } | null {
  if (filter.kind === "range") return { from: filter.from, to: filter.to };
  if (filter.kind !== "preset") return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filter.preset) {
    case "today":
      return { from: todayKey(today), to: todayKey(today) };
    case "tomorrow":
      return { from: todayKey(addDays(today, 1)), to: todayKey(addDays(today, 1)) };
    case "week": {
      // Monday to Sunday.
      const monday = addDays(today, -((today.getDay() + 6) % 7));
      return { from: todayKey(monday), to: todayKey(addDays(monday, 6)) };
    }
    case "next7":
      return { from: todayKey(today), to: todayKey(addDays(today, 6)) };
    case "month":
      return {
        from: todayKey(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: todayKey(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      };
  }
}

/** Whether a task (or anything with a timeline) passes the date filter. */
export function matchesDate(task: { start?: string; end?: string }, filter: DateFilter, now = new Date()): boolean {
  if (filter.kind === "any") return true;
  const scheduled = !!task.start && !!task.end;
  if (filter.kind === "none") return !scheduled;
  if (!scheduled) return false;
  const range = dateRangeOf(filter, now)!;
  // Timelines are "YYYY-MM-DDTHH:mm", so their first 10 characters compare as days.
  return task.start!.slice(0, 10) <= range.to && task.end!.slice(0, 10) >= range.from;
}

/** "3 Dec", or "3 Dec 2027" outside the current year. */
function formatDay(key: string, now: Date) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(y !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** What the filter button shows; null when the filter is off. */
export function dateFilterLabel(filter: DateFilter, now = new Date()): string | null {
  switch (filter.kind) {
    case "any":
      return null;
    case "none":
      return "No date";
    case "preset":
      return DATE_PRESETS.find((p) => p.id === filter.preset)!.label;
    case "range":
      return filter.from === filter.to
        ? formatDay(filter.from, now)
        : `${formatDay(filter.from, now)} – ${formatDay(filter.to, now)}`;
  }
}
