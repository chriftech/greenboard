/**
 * Import tasks from a CSV or Excel file. (The Excel template and .xlsx reading are in lib/xlsx.ts.)
 *
 * Reading a file is done in two steps, so people can check before anything changes:
 *   previewImport(csvText) or previewRows(rows) → what would be added, and which rows have problems
 *   applyImport(preview) → adds the tags, people and tasks
 *
 * Columns (any order, headings not case-sensitive; only Title is required):
 *   Title, Status, Tag, Priority, Assignee, Start, End, Description, Created, Completed
 * These are the same columns Export writes, so an exported file imports as-is.
 */

import { DEFAULT_TAG, PRIORITIES, TAGS, isValidSchedule, taskActions, type PriorityId, type Schedule, type Task } from "./tasks";
import { MAX_CUSTOM_TAGS, MAX_TAG_LABEL, TAG_COLORS, getCustomTags, tagActions } from "./tags";
import { MAX_PERSON_NAME, ME, getPeople, peopleActions } from "./people";
import { parseCsv } from "./csv";
import { DONE_COLUMN, TODO_COLUMN, getColumns } from "./columns";

/** More than this and the file is probably not a task list. */
export const MAX_IMPORT_ROWS = 500;
/** 1 MB is far more than 500 tasks need. */
export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_TITLE = 200;

type Field = "title" | "status" | "tag" | "priority" | "assignee" | "start" | "end" | "description" | "created" | "completed";

/** Accepted headings for each column (lowercase). The first is the one we write. */
const HEADINGS: Record<Field, string[]> = {
  title: ["title", "task", "name"],
  status: ["status", "state"],
  tag: ["tag", "category", "label", "list"],
  priority: ["priority"],
  assignee: ["assignee", "assigned to", "owner"],
  start: ["start", "start date", "starts"],
  end: ["end", "end date", "ends", "due", "due date"],
  description: ["description", "notes", "details"],
  created: ["created", "created at", "date created"],
  completed: ["completed", "completed at", "done at", "date completed"],
};

const DONE_WORDS = new Set(["completed", "complete", "done", "yes", "y", "true", "1", "x", "✓", "✔"]);
/** Started but not finished. */
const PENDING_WORDS = new Set(["pending", "in progress", "in-progress", "doing", "started", "ongoing", "wip"]);
const TODO_WORDS = new Set(["", "todo", "to do", "to-do", "not started", "open", "not done", "no", "n", "false", "0"]);

/** Where a draft task's tag or person comes from: one that exists, or one to create. */
type Ref = { id: string } | { create: string };

export type DraftTask = {
  title: string;
  done: boolean;
  /** The column a not-done task goes in (unset: Todo). */
  column?: string;
  tag: Ref;
  priority?: PriorityId;
  assignee?: Ref;
  schedule?: Schedule;
  descriptionText?: string;
  createdAt: number;
  doneAt?: number;
};

/** A problem with one row. `row` is the line number in the spreadsheet (the heading is row 1). */
export type ImportIssue = { row: number; message: string };

export type ImportPreview = {
  tasks: DraftTask[];
  /** Rows that won't be imported. */
  skipped: ImportIssue[];
  /** Rows that will be imported, but with something left out. */
  warnings: ImportIssue[];
  newTags: string[];
  newPeople: string[];
  /** Headings we don't recognise (their columns are ignored). */
  ignoredColumns: string[];
  /** A problem with the whole file; nothing can be imported. */
  error?: string;
};

const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const key = (s: string) => clean(s).toLowerCase();

/** Undo the apostrophe Export (and spreadsheets) put before text that looks like a formula. */
const unguard = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A date, or date and time, as "YYYY-MM-DDTHH:mm". Accepts 2026-11-20, 2026/11/20,
 * "2026-11-20 09:30", "2026-11-20T09:30" (seconds ignored). Date-only values get `defaultTime`.
 */
function parseDateTime(value: string, defaultTime: string): string | null {
  const m = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // Reject dates that don't exist, like 2026-02-30.
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  const time = h !== undefined ? `${pad(Number(h))}:${mi}` : defaultTime;
  if (Number(time.slice(0, 2)) > 23) return null;
  return `${y}-${pad(Number(mo))}-${pad(Number(d))}T${time}`;
}

/** A moment in local time (ms), or null. */
function parseMoment(value: string): number | null {
  const iso = parseDateTime(value, "00:00");
  return iso ? new Date(iso).getTime() : null;
}

/** Work out what a CSV file would add, without changing anything. */
export function previewImport(text: string): ImportPreview {
  return previewRows(parseCsv(text));
}

/** Work out what these rows (headings first) would add, without changing anything. */
export function previewRows(rows: string[][]): ImportPreview {
  const boardColumns = getColumns();
  // Unmatched statuses land in Todo, wherever it sits on the board.
  const todoLabel = boardColumns.find((c) => c.id === TODO_COLUMN)?.label ?? "Todo";
  const preview: ImportPreview = { tasks: [], skipped: [], warnings: [], newTags: [], newPeople: [], ignoredColumns: [] };
  const blank = (r: string[]) => r.every((c) => c.trim() === "");
  // The headings are the first row with anything in it.
  const headerAt = rows.findIndex((r) => !blank(r));
  if (headerAt === -1) return { ...preview, error: "This file is empty." };

  // Match the headings to fields.
  const columns = new Map<Field, number>();
  rows[headerAt].forEach((heading, i) => {
    const h = key(heading.replace(/^﻿/, ""));
    const field = (Object.keys(HEADINGS) as Field[]).find((f) => HEADINGS[f].includes(h));
    if (field && !columns.has(field)) columns.set(field, i);
    else if (h) preview.ignoredColumns.push(clean(heading));
  });
  if (!columns.has("title")) {
    return { ...preview, error: "The first row needs a “Title” column. Download the template to see the format." };
  }
  // Every row under the headings, with its row number in the spreadsheet; blank rows are left out.
  const body = rows
    .map((cells, i) => ({ cells, row: i + 1 }))
    .slice(headerAt + 1)
    .filter((r) => !blank(r.cells));
  if (body.length === 0) return { ...preview, error: "There are no tasks under the headings." };
  if (body.length > MAX_IMPORT_ROWS) {
    return { ...preview, error: `This file has more than ${MAX_IMPORT_ROWS} tasks. Import up to ${MAX_IMPORT_ROWS} at a time.` };
  }

  // What already exists, by lowercase name.
  const tagIds = new Map<string, string>();
  for (const t of TAGS) tagIds.set(t.label.toLowerCase(), t.id).set(t.id, t.id);
  for (const t of getCustomTags()) tagIds.set(t.label.toLowerCase(), t.id);
  const freeTagSlots = MAX_CUSTOM_TAGS - getCustomTags().length;
  const personIds = new Map<string, string>([[ME.name.toLowerCase(), ME.id]]);
  for (const p of getPeople()) personIds.set(p.name.toLowerCase(), p.id);
  const priorityIds = new Map<string, PriorityId>(PRIORITIES.flatMap((p) => [[p.label.toLowerCase(), p.id], [p.id, p.id]] as [string, PriorityId][]));

  const now = Date.now();
  body.forEach(({ cells, row }) => {
    const get = (f: Field) => {
      const at = columns.get(f);
      return at === undefined ? "" : unguard(cells[at] ?? "").trim();
    };
    const warn = (message: string) => preview.warnings.push({ row, message });

    const rawTitle = clean(get("title"));
    if (!rawTitle) {
      preview.skipped.push({ row, message: "No title." });
      return;
    }
    let title = rawTitle;
    if (title.length > MAX_TITLE) {
      title = title.slice(0, MAX_TITLE);
      warn(`Title shortened to ${MAX_TITLE} characters.`);
    }

    // Status
    // A column's own name wins (custom columns included); then the usual words.
    const status = key(get("status"));
    const named = boardColumns.find((c) => c.label.toLowerCase() === status)?.id;
    const done = named === DONE_COLUMN || (!named && DONE_WORDS.has(status));
    let column: string | undefined = named && named !== DONE_COLUMN && named !== TODO_COLUMN ? named : undefined;
    if (!named && !done && PENDING_WORDS.has(status)) {
      if (boardColumns.some((c) => c.id === "pending")) column = "pending";
      else warn(`There’s no Pending column, so “${get("status")}” goes in ${todoLabel}.`);
    } else if (!named && !done && !TODO_WORDS.has(status)) {
      warn(`Status “${get("status")}” doesn’t match a column, so it goes in ${todoLabel}.`);
    }

    // Tag: an existing one, a new one (if there's room), or Default.
    let tag: Ref = { id: DEFAULT_TAG };
    const tagName = clean(get("tag"));
    if (tagName) {
      const existing = tagIds.get(tagName.toLowerCase());
      const planned = preview.newTags.find((t) => t.toLowerCase() === tagName.toLowerCase());
      if (existing) tag = { id: existing };
      else if (planned) tag = { create: planned };
      else if (tagName.length > MAX_TAG_LABEL) warn(`Tag “${tagName}” is longer than ${MAX_TAG_LABEL} characters, so it’s Default.`);
      else if (preview.newTags.length >= freeTagSlots) warn(`No room for a new tag “${tagName}” (${MAX_CUSTOM_TAGS} custom tags at most), so it’s Default.`);
      else {
        preview.newTags.push(tagName);
        tag = { create: tagName };
      }
    }

    // Priority
    let priority: PriorityId | undefined;
    const priorityName = key(get("priority"));
    if (priorityName && priorityName !== "none") {
      priority = priorityIds.get(priorityName);
      if (!priority) warn(`Priority “${get("priority")}” isn’t Urgent, High, Medium or Low, so it’s left out.`);
    }

    // Assignee: an existing person, or someone new to add.
    let assignee: Ref | undefined;
    const personName = clean(get("assignee")).slice(0, MAX_PERSON_NAME);
    if (personName) {
      const existing = personIds.get(personName.toLowerCase());
      const planned = preview.newPeople.find((p) => p.toLowerCase() === personName.toLowerCase());
      if (existing) assignee = { id: existing };
      else if (planned) assignee = { create: planned };
      else {
        preview.newPeople.push(personName);
        assignee = { create: personName };
      }
    }

    // Timeline: needs both ends, end after start.
    let schedule: Schedule | undefined;
    const startText = get("start");
    const endText = get("end");
    if (startText || endText) {
      const start = startText ? parseDateTime(startText, "00:00") : null;
      const end = endText ? parseDateTime(endText, "23:59") : null;
      if (!startText || !endText) warn("A timeline needs both Start and End, so it’s left out.");
      else if (!start) warn(`Start “${startText}” isn’t a date like 2026-11-20 09:00, so the timeline is left out.`);
      else if (!end) warn(`End “${endText}” isn’t a date like 2026-11-20 17:00, so the timeline is left out.`);
      else if (!isValidSchedule({ start, end })) warn("End is before Start, so the timeline is left out.");
      else schedule = { start, end };
    }

    const descriptionText = get("description").replace(/\r\n?/g, "\n").trim() || undefined;
    const createdAt = parseMoment(get("created")) ?? now;
    const doneAt = done ? (parseMoment(get("completed")) ?? now) : undefined;

    preview.tasks.push({
      title,
      done,
      ...(column ? { column } : {}),
      tag,
      priority,
      assignee,
      schedule,
      descriptionText,
      createdAt,
      doneAt,
    });
  });

  return preview;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text as the editor's HTML: one paragraph per line. */
const toHtml = (text: string) =>
  text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

/** Add the previewed tags, people and tasks. Returns how many tasks were added. */
export function applyImport(preview: ImportPreview): number {
  if (preview.error || preview.tasks.length === 0) return 0;

  const createdTags = new Map<string, string>();
  const usedColors = getCustomTags().length;
  preview.newTags.forEach((label, i) => {
    const id = tagActions.add(label, TAG_COLORS[(usedColors + i) % TAG_COLORS.length]);
    if (id) createdTags.set(label, id);
  });
  const createdPeople = new Map<string, string>();
  for (const name of preview.newPeople) {
    const id = peopleActions.add(name);
    if (id) createdPeople.set(name, id);
  }
  const resolve = (ref: Ref | undefined, created: Map<string, string>) =>
    !ref ? undefined : "id" in ref ? ref.id : created.get(ref.create);

  const tasks: Omit<Task, "id" | "order">[] = preview.tasks.map((d) => ({
    title: d.title,
    done: d.done,
    ...(d.column && !d.done ? { column: d.column } : {}),
    tag: resolve(d.tag, createdTags) ?? DEFAULT_TAG,
    ...(d.priority ? { priority: d.priority } : {}),
    ...(() => {
      const assignee = resolve(d.assignee, createdPeople);
      return assignee ? { assignee } : {};
    })(),
    ...(d.schedule ?? {}),
    ...(d.descriptionText ? { description: toHtml(d.descriptionText), descriptionText: d.descriptionText } : {}),
    createdAt: d.createdAt,
    ...(d.doneAt ? { doneAt: d.doneAt } : {}),
  }));
  taskActions.importMany(tasks);
  return tasks.length;
}
