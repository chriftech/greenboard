/**
 * Export the board's tasks as a CSV file (opens in Excel, Numbers or Google Sheets).
 * Everything on the board is included, column by column (left to right), in board
 * order, or just one status (column); tasks in Trash are left out. Browser only: it
 * reads this browser's tasks.
 *
 * The columns match what import reads (lib/import.ts), so an export can be imported again.
 */

import { getTasks, PRIORITIES, statusOf, TAGS, type Task } from "./tasks";
import { getColumns } from "./columns";
import { getCustomTags } from "./tags";
import { getPeople, ME } from "./people";
import { downloadCsv, fileDate, formatDateTime, toCsv } from "./csv";

export const TASK_COLUMNS = [
  "Title",
  "Status",
  "Tag",
  "Priority",
  "Assignee",
  "Start",
  "End",
  "Description",
  "Created",
  "Completed",
] as const;

/** Schedules are stored as "YYYY-MM-DDTHH:mm"; show them like the other dates. */
const formatSchedule = (value: string | undefined) => (value ? value.replace("T", " ") : "");

/** The CSV text for these tasks. */
export function tasksToCsv(tasks: Task[]): string {
  const tagLabels = new Map<string, string>([
    ...TAGS.map((t) => [t.id, t.label] as [string, string]),
    ...getCustomTags().map((t) => [t.id, t.label] as [string, string]),
  ]);
  const people = new Map([ME, ...getPeople()].map((p) => [p.id, p.name]));
  const priorities = new Map<string, string>(PRIORITIES.map((p) => [p.id, p.label]));

  const onBoard = tasks.filter((t) => !t.deletedAt);
  const byOrder = (a: Task, b: Task) => a.order - b.order;
  const columns = getColumns();
  const ordered = columns.flatMap((c) => onBoard.filter((t) => statusOf(t) === c.id).sort(byOrder));
  const statusLabels = new Map(columns.map((c) => [c.id, c.label]));

  const rows = ordered.map((t) => [
    t.title,
    statusLabels.get(statusOf(t)) ?? "",
    tagLabels.get(t.tag) ?? "Default",
    t.priority ? (priorities.get(t.priority) ?? "") : "",
    t.assignee ? (people.get(t.assignee) ?? "") : "",
    formatSchedule(t.start),
    formatSchedule(t.end),
    t.descriptionText?.trim() ?? "",
    formatDateTime(t.createdAt),
    t.done ? formatDateTime(t.doneAt) : "",
  ]);

  return toCsv([TASK_COLUMNS, ...rows]);
}

/** A column's label as a file-name part: "In review" → "in-review". */
const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "status";

/**
 * Download this browser's tasks as greenboard-tasks-<date>.csv, or only one status
 * (a column id) as greenboard-tasks-<status>-<date>.csv. Returns how many tasks were exported.
 */
export function downloadTasksCsv(status?: string): number {
  const all = getTasks();
  const tasks = status ? all.filter((t) => statusOf(t) === status) : all;
  const label = status ? getColumns().find((c) => c.id === status)?.label : undefined;
  const name = label ? `greenboard-tasks-${slug(label)}-${fileDate()}.csv` : `greenboard-tasks-${fileDate()}.csv`;
  downloadCsv(name, tasksToCsv(tasks));
  return tasks.filter((t) => !t.deletedAt).length;
}
