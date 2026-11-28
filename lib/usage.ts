/**
 * Platform usage: totals worked out from this browser's tasks, columns and tags,
 * plus how much of the plan's limits is in use. Exported as CSV or JSON from the
 * Usage page. Pure functions apart from the downloads (browser only).
 */

import { DONE_COLUMN, TODO_COLUMN, type BoardColumn } from "./columns";
import { PLAN_LIMITS, PLAN_NAMES, type PlanId } from "./plan";
import { PRIORITIES, statusOf, todayKey, type Task } from "./tasks";
import { isCreatedTag, type TagView } from "./tags";
import { downloadCsv, fileDate, formatDateTime, toCsv } from "./csv";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How many days the activity chart covers, ending today. */
export const ACTIVITY_DAYS = 14;

export type Breakdown = { id: string; label: string; count: number; color?: string };
export type DayActivity = { day: string; created: number; completed: number };

export type Usage = {
  generatedAt: number;
  plan: { id: PlanId; name: string };
  totals: {
    /** Tasks on the board (not in Trash). */
    tasks: number;
    completed: number;
    open: number;
    /** Completed out of tasks on the board, 0–100. */
    completionRate: number;
    inTrash: number;
    subtasks: number;
    subtasksDone: number;
    scheduled: number;
    overdue: number;
    createdThisWeek: number;
    completedThisWeek: number;
  };
  /** First task created (ms), if any. */
  since: number | null;
  limits: {
    columns: { used: number; limit: number };
    tags: { used: number; limit: number };
    trashDays: number;
  };
  byColumn: Breakdown[];
  byTag: Breakdown[];
  byPriority: Breakdown[];
  activity: DayActivity[];
};

/** "YYYY-MM-DD" for a moment, in local time. */
const dayOf = (ms: number) => todayKey(new Date(ms));

export function computeUsage({
  tasks,
  columns,
  tags,
  plan,
  now = Date.now(),
}: {
  tasks: Task[];
  columns: BoardColumn[];
  tags: TagView[];
  plan: PlanId;
  now?: number;
}): Usage {
  const onBoard = tasks.filter((t) => t.deletedAt === undefined);
  const completed = onBoard.filter((t) => t.done);
  const weekAgo = now - 7 * DAY_MS;
  const nowKey = `${todayKey(new Date(now))}T${new Date(now).toTimeString().slice(0, 5)}`;
  const subtasks = onBoard.flatMap((t) => t.subtasks ?? []);
  const limits = PLAN_LIMITS[plan];

  const count = <T,>(list: T[], key: (item: T) => string) => {
    const counts = new Map<string, number>();
    for (const item of list) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
    return counts;
  };

  const perColumn = count(onBoard, (t) => statusOf(t));
  const perTag = count(onBoard, (t) => (tags.some((g) => g.id === t.tag) ? t.tag : "default"));
  const perPriority = count(onBoard, (t) => t.priority ?? "none");

  // One entry per day, oldest first, ending today.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const activity: DayActivity[] = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (ACTIVITY_DAYS - 1 - i));
    return { day: todayKey(d), created: 0, completed: 0 };
  });
  const byDay = new Map(activity.map((a) => [a.day, a]));
  for (const t of tasks) {
    const created = byDay.get(dayOf(t.createdAt));
    if (created) created.created++;
    if (t.done && t.doneAt) {
      const done = byDay.get(dayOf(t.doneAt));
      if (done) done.completed++;
    }
  }

  return {
    generatedAt: now,
    plan: { id: plan, name: PLAN_NAMES[plan] },
    totals: {
      tasks: onBoard.length,
      completed: completed.length,
      open: onBoard.length - completed.length,
      completionRate: onBoard.length ? Math.round((completed.length / onBoard.length) * 100) : 0,
      inTrash: tasks.length - onBoard.length,
      subtasks: subtasks.length,
      subtasksDone: subtasks.filter((s) => s.done).length,
      scheduled: onBoard.filter((t) => t.start && t.end).length,
      overdue: onBoard.filter((t) => !t.done && t.end && t.end < nowKey).length,
      createdThisWeek: tasks.filter((t) => t.createdAt >= weekAgo).length,
      completedThisWeek: tasks.filter((t) => t.done && t.doneAt && t.doneAt >= weekAgo).length,
    },
    since: tasks.length ? Math.min(...tasks.map((t) => t.createdAt)) : null,
    limits: {
      // Todo and Completed don't count towards the plan's columns.
      columns: { used: columns.filter((c) => c.id !== TODO_COLUMN && c.id !== DONE_COLUMN).length, limit: limits.extraColumns },
      tags: { used: tags.filter((t) => isCreatedTag(t.id)).length, limit: limits.createdTags },
      trashDays: limits.trashDays,
    },
    byColumn: columns.map((c) => ({ id: c.id, label: c.label, count: perColumn.get(c.id) ?? 0 })),
    byTag: tags
      .map((t) => ({ id: t.id, label: t.label, count: perTag.get(t.id) ?? 0, color: t.color }))
      .sort((a, b) => b.count - a.count),
    byPriority: [
      ...PRIORITIES.map((p) => ({ id: p.id, label: p.label, count: perPriority.get(p.id) ?? 0, color: p.color })),
      { id: "none", label: "No priority", count: perPriority.get("none") ?? 0 },
    ],
    activity,
  };
}

const limitText = (n: number) => (Number.isFinite(n) ? String(n) : "Unlimited");

/** The usage report as CSV rows: Section, Item, Value. */
export function usageToCsv(u: Usage): string {
  const t = u.totals;
  const rows: string[][] = [
    ["Section", "Item", "Value"],
    ["Report", "Generated", formatDateTime(u.generatedAt)],
    ["Report", "Using Greenboard since", u.since ? formatDateTime(u.since) : ""],
    ["Plan", "Current plan", u.plan.name],
    ["Plan", "Columns of your own", `${u.limits.columns.used} of ${limitText(u.limits.columns.limit)}`],
    ["Plan", "Tags you created", `${u.limits.tags.used} of ${limitText(u.limits.tags.limit)}`],
    ["Plan", "Days kept in Trash", String(u.limits.trashDays)],
    ["Totals", "Tasks on the board", String(t.tasks)],
    ["Totals", "Completed", String(t.completed)],
    ["Totals", "Open", String(t.open)],
    ["Totals", "Completion rate (%)", String(t.completionRate)],
    ["Totals", "In Trash", String(t.inTrash)],
    ["Totals", "Subtasks", String(t.subtasks)],
    ["Totals", "Subtasks done", String(t.subtasksDone)],
    ["Totals", "Scheduled", String(t.scheduled)],
    ["Totals", "Overdue", String(t.overdue)],
    ["Totals", "Created in the last 7 days", String(t.createdThisWeek)],
    ["Totals", "Completed in the last 7 days", String(t.completedThisWeek)],
    ...u.byColumn.map((b) => ["Tasks by column", b.label, String(b.count)]),
    ...u.byTag.map((b) => ["Tasks by tag", b.label, String(b.count)]),
    ...u.byPriority.map((b) => ["Tasks by priority", b.label, String(b.count)]),
    ...u.activity.map((a) => ["Created per day", a.day, String(a.created)]),
    ...u.activity.map((a) => ["Completed per day", a.day, String(a.completed)]),
  ];
  return toCsv(rows);
}

export function downloadUsageCsv(u: Usage) {
  downloadCsv(`greenboard-usage-${fileDate()}.csv`, usageToCsv(u));
}

/** The usage report as a JSON file (limits that are unlimited are written as null). */
export function downloadUsageJson(u: Usage) {
  const json = JSON.stringify(u, (_key, value) => (value === Infinity ? null : value), 2);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `greenboard-usage-${fileDate()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
