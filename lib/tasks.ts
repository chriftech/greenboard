import { DONE_COLUMN, TODO_COLUMN, getColumns, getTickColumn, knownColumn, tickDestination, type BoardColumn } from "./columns";

/**
 * Client-side task store backed by localStorage.
 *
 * Read it from React with:
 *   useSyncExternalStore(subscribeTasks, getTasks, getServerTasks)
 * The server snapshot is `null`, meaning "not loaded yet", so the first
 * render matches the server HTML and tasks appear right after hydration.
 */

/** Built-in tags. Users can add up to 5 more (see lib/tags.ts). */
export const TAGS = [
  { id: "default", label: "Default", chip: "bg-ink/10 text-ink/75", dot: "bg-ink/40" },
  { id: "work", label: "Work", chip: "bg-grape/15 text-[#5b2fd1] dark:text-[#c9b6ff]", dot: "bg-grape" },
  { id: "personal", label: "Personal", chip: "bg-coral/15 text-[#c23a22] dark:text-[#ffab9c]", dot: "bg-coral" },
  { id: "team", label: "Team", chip: "bg-skyblue/15 text-[#0b6aa8] dark:text-[#8fd3ff]", dot: "bg-skyblue" },
  { id: "health", label: "Health", chip: "bg-[#14b8a6]/15 text-[#0f766e] dark:text-[#5eead4]", dot: "bg-[#14b8a6]" },
  { id: "home", label: "Home", chip: "bg-sunny/25 text-[#8a5a00] dark:text-[#ffd77a]", dot: "bg-sunny" },
] as const;

/** A built-in tag id or a custom tag id ("custom-…"). */
export type TagId = string;

/** Tag preselected for new tasks, and the fallback for unknown tags. */
export const DEFAULT_TAG: TagId = "default";

/** Task priority, highest first. No priority is stored as undefined. */
export const PRIORITIES = [
  { id: "urgent", label: "Urgent", color: "#ff6f59" },
  { id: "high", label: "High", color: "#f97316" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "low", label: "Low", color: "#4ab4ff" },
] as const;

export type PriorityId = (typeof PRIORITIES)[number]["id"];
const PRIORITY_IDS = new Set<string>(PRIORITIES.map((p) => p.id));

export type Task = {
  id: string;
  title: string;
  tag: TagId;
  /**
   * Optional schedule as local "YYYY-MM-DDTHH:mm" strings. A task has either
   * both a start and an end (end after start) or neither.
   */
  start?: string;
  end?: string;
  done: boolean;
  createdAt: number;
  /** Position on the board; lower comes first. Changed by drag and drop. */
  order: number;
  /** When the task was moved to Trash (ms). Trashed tasks are hidden from the board. */
  deletedAt?: number;
  doneAt?: number;
  /** Rich-text description as HTML produced by the task editor. */
  description?: string;
  /** Plain-text copy of the description, for previews and search. */
  descriptionText?: string;
  /** Priority, if set. */
  priority?: PriorityId;
  /** Person the task is assigned to: an id from lib/people.ts ("me" or "person-…"). */
  assignee?: string;
  /** The column a not-done task sits in (see lib/columns.ts). Unset means Todo. */
  column?: string;
  /** Older saves: started but not finished, before custom columns. Read as the Pending column. */
  inProgress?: boolean;
  /** Smaller steps inside the task, in the order shown. */
  subtasks?: Subtask[];
};

/** A step inside a task, with its own tick, assignee, priority and timeline. */
export type Subtask = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  assignee?: string;
  priority?: PriorityId;
  /** Local "YYYY-MM-DDTHH:mm" strings: both or neither, end after start. */
  start?: string;
  end?: string;
};

export type SubtaskPatch = Partial<Pick<Subtask, "title" | "assignee" | "priority">>;

function isSubtask(v: unknown): v is Subtask {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.done === "boolean" &&
    typeof s.createdAt === "number" &&
    (s.assignee === undefined || typeof s.assignee === "string") &&
    (s.priority === undefined || (typeof s.priority === "string" && PRIORITY_IDS.has(s.priority)))
  );
}

/** Keep a subtask's schedule only when it's whole and valid. */
function normalizeSubtask(s: Subtask): Subtask {
  if (s.start === undefined && s.end === undefined) return s;
  if (isValidSchedule({ start: s.start, end: s.end })) return s;
  const { start: _s, end: _e, ...rest } = s;
  void _s;
  void _e;
  return rest;
}

/** How many of a task's subtasks are ticked, out of how many. */
export function subtaskProgress(t: Pick<Task, "subtasks">) {
  const list = t.subtasks ?? [];
  return { done: list.filter((s) => s.done).length, total: list.length };
}

/**
 * Where a task is on the board: a column id from lib/columns.ts. "todo" and
 * "done" (Completed) always exist; the rest are the user's columns.
 */
export type TaskStatus = string;

/** The column a task is in. A column that's been deleted reads as Todo. */
export function statusOf(t: Pick<Task, "done" | "column" | "inProgress">): TaskStatus {
  if (t.done) return DONE_COLUMN;
  return knownColumn(t.column ?? (t.inProgress ? "pending" : TODO_COLUMN));
}

type StatusFields = Pick<Task, "done" | "column" | "inProgress">;

/** Whether a task shows as ticked: it's done, or it's in the column ticking sends tasks to. */
export function isTicked(t: StatusFields, tickColumn: string = getTickColumn()): boolean {
  return t.done || statusOf(t) === tickColumn;
}

/** Where ticking a task sends it (its column's destination, else the tick column), or unticking it (back to Todo). */
export function tickTarget(t: StatusFields, tickColumn: string = getTickColumn(), columns: BoardColumn[] = getColumns()): TaskStatus {
  return isTicked(t, tickColumn) ? TODO_COLUMN : tickDestination(statusOf(t), columns, tickColumn);
}

/** The fields that store a status: done tasks keep doneAt; others keep their column (none for Todo). */
function withStatus<T extends Task>(t: T, status: TaskStatus): T {
  const { inProgress: _p, doneAt: _d, column: _c, ...rest } = t;
  void _p;
  void _d;
  void _c;
  if (status === DONE_COLUMN) return { ...rest, done: true, doneAt: t.done ? t.doneAt : Date.now() } as T;
  return { ...rest, done: false, ...(status !== TODO_COLUMN ? { column: status } : {}) } as T;
}

export type TaskPatch = Partial<
  Pick<Task, "title" | "tag" | "description" | "descriptionText" | "priority" | "assignee">
>;

export type Schedule = { start: string; end: string };

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A schedule is valid when both ends are full date+time values and end > start. */
export function isValidSchedule(s: Partial<Schedule> | null | undefined): s is Schedule {
  return (
    !!s &&
    typeof s.start === "string" &&
    typeof s.end === "string" &&
    DATETIME_RE.test(s.start) &&
    DATETIME_RE.test(s.end) &&
    s.end > s.start
  );
}

const KEY = "greenboard.tasks.v1";

/** How long a task stays in Trash before it's deleted for good. */
export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRASH_MS = TRASH_DAYS * DAY_MS;

const isExpired = (t: Task, now: number) => t.deletedAt !== undefined && now - t.deletedAt >= TRASH_MS;

/** Whole days until a trashed task is deleted for good (at least 0). */
export function trashDaysLeft(t: Task, now = Date.now()) {
  if (t.deletedAt === undefined) return TRASH_DAYS;
  return Math.max(0, Math.ceil((t.deletedAt + TRASH_MS - now) / DAY_MS));
}

let cache: Task[] | null = null;
const listeners = new Set<() => void>();

function isTask(v: unknown): v is Task {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.done === "boolean" &&
    typeof t.createdAt === "number" &&
    (t.order === undefined || typeof t.order === "number") &&
    (t.deletedAt === undefined || typeof t.deletedAt === "number") &&
    // Any non-empty tag id is kept; an unknown one (e.g. a deleted custom tag)
    // is shown as Default rather than dropping the task.
    typeof t.tag === "string" &&
    t.tag.length > 0 &&
    (t.description === undefined || typeof t.description === "string") &&
    (t.descriptionText === undefined || typeof t.descriptionText === "string") &&
    (t.priority === undefined || (typeof t.priority === "string" && PRIORITY_IDS.has(t.priority))) &&
    (t.assignee === undefined || typeof t.assignee === "string") &&
    (t.inProgress === undefined || typeof t.inProgress === "boolean") &&
    (t.column === undefined || typeof t.column === "string") &&
    (t.subtasks === undefined || Array.isArray(t.subtasks))
  );
}

/**
 * Fill in defaults for tasks saved by older versions, and drop a half-set or
 * invalid schedule rather than keeping a broken one.
 */
function normalize(t: Task): Task {
  // Tasks saved before reordering existed keep their newest-first position.
  if (typeof t.order !== "number") t = { ...t, order: -t.createdAt };
  // Broken subtasks are dropped one by one; the task keeps the rest.
  if (t.subtasks !== undefined) {
    const subtasks = t.subtasks.filter(isSubtask).map(normalizeSubtask);
    if (subtasks.length) t = { ...t, subtasks };
    else {
      const { subtasks: _st, ...rest } = t;
      void _st;
      t = rest;
    }
  }
  if (t.start === undefined && t.end === undefined) return t;
  if (isValidSchedule({ start: t.start, end: t.end })) return t;
  const { start: _s, end: _e, ...rest } = t;
  void _s;
  void _e;
  return rest;
}

function load(): Task[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const tasks = Array.isArray(parsed) ? parsed.filter(isTask).map(normalize) : [];
    // Permanently delete anything that has been in Trash for 30 days or more.
    const now = Date.now();
    const kept = tasks.filter((t) => !isExpired(t, now));
    if (kept.length !== tasks.length) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(kept));
      } catch {
        // Ignore: they'll be purged on the next load instead.
      }
    }
    return kept;
  } catch {
    return [];
  }
}

function save(next: Task[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode): keep working in memory.
  }
  listeners.forEach((l) => l());
}

export function getTasks(): Task[] {
  if (cache === null) cache = load();
  return cache;
}

export function getServerTasks(): Task[] | null {
  return null;
}

export function subscribeTasks(listener: () => void) {
  listeners.add(listener);
  // Keep several open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Replace one task's subtask list. An empty list removes the field. */
function editSubtasks(taskId: string, edit: (list: Subtask[]) => Subtask[]) {
  save(
    getTasks().map((t) => {
      if (t.id !== taskId) return t;
      const list = edit(t.subtasks ?? []);
      if (list.length) return { ...t, subtasks: list };
      const { subtasks: _st, ...rest } = t;
      void _st;
      return rest;
    }),
  );
}

export const taskActions = {
  /**
   * Add a task, in Todo unless `status` names another column (e.g. from a board column's "Add task").
   * It goes above every other task, or below them with `position: "bottom"` (a column's bottom "Add task").
   */
  add(input: {
    title: string;
    tag: TagId;
    schedule?: Schedule;
    priority?: PriorityId;
    assignee?: string;
    status?: TaskStatus;
    description?: { html: string; text: string };
    position?: "top" | "bottom";
  }) {
    const title = input.title.trim();
    if (!title) return;
    if (input.schedule && !isValidSchedule(input.schedule)) return;
    const task: Task = {
      id: newId(),
      title,
      tag: input.tag,
      ...(input.schedule ?? {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.assignee ? { assignee: input.assignee } : {}),
      ...(input.description?.text ? { description: input.description.html, descriptionText: input.description.text } : {}),
      done: false,
      createdAt: Date.now(),
      // Ahead of every existing task, so new tasks appear at the top (or after them all, at the bottom).
      order:
        input.position === "bottom"
          ? Math.max(0, ...getTasks().map((t) => t.order + 1))
          : Math.min(-Date.now(), ...getTasks().map((t) => t.order - 1)),
    };
    save([input.status ? withStatus(task, input.status) : task, ...getTasks()]);
  },
  /** Tick a task (to its column's destination, Completed by default), or untick it (back to Todo). */
  toggle(id: string) {
    save(getTasks().map((t) => (t.id === id ? withStatus(t, tickTarget(t)) : t)));
  },
  /** Move a task to a column (Completed ticks it off). */
  setStatus(id: string, status: TaskStatus) {
    save(getTasks().map((t) => (t.id === id && statusOf(t) !== status ? withStatus(t, status) : t)));
  },
  /**
   * Copy tasks into a column: each copy keeps the title, tag, priority, assignee,
   * schedule, description and subtasks, gets new ids, and goes to the top of the
   * board in the same order as the originals. Returns how many were copied.
   */
  copy(ids: string[], status: TaskStatus) {
    const tasks = getTasks();
    const wanted = new Set(ids);
    const originals = tasks.filter((t) => wanted.has(t.id) && !t.deletedAt).sort((a, b) => a.order - b.order);
    if (!originals.length) return 0;
    const top = Math.min(-Date.now(), ...tasks.map((t) => t.order - 1));
    const now = Date.now();
    const copies = originals.map((t, i) => {
      const { deletedAt: _del, ...rest } = t;
      void _del;
      const copy: Task = {
        ...rest,
        id: newId(),
        createdAt: now,
        order: top - (originals.length - 1 - i),
        ...(t.subtasks ? { subtasks: t.subtasks.map((s) => ({ ...s, id: newId() })) } : {}),
      };
      return withStatus(copy, status);
    });
    save([...copies, ...tasks]);
    return copies.length;
  },
  /** Move every task in one column to another (used before a column is deleted). Trash included. */
  moveColumn(from: TaskStatus, to: TaskStatus) {
    const tasks = getTasks();
    if (tasks.some((t) => statusOf(t) === from)) save(tasks.map((t) => (statusOf(t) === from ? withStatus(t, to) : t)));
  },
  rename(id: string, title: string) {
    const clean = title.trim();
    if (!clean) return;
    save(getTasks().map((t) => (t.id === id ? { ...t, title: clean } : t)));
  },
  update(id: string, patch: TaskPatch) {
    const next = { ...patch };
    if (next.title !== undefined) {
      next.title = next.title.trim();
      if (!next.title) delete next.title;
    }
    save(getTasks().map((t) => (t.id === id ? { ...t, ...next } : t)));
  },
  /** Set both start and end together, or pass null to remove the schedule. */
  setSchedule(id: string, schedule: Schedule | null) {
    if (schedule && !isValidSchedule(schedule)) return;
    save(
      getTasks().map((t) => {
        if (t.id !== id) return t;
        const { start: _s, end: _e, ...rest } = t;
        void _s;
        void _e;
        return schedule ? { ...rest, start: schedule.start, end: schedule.end } : rest;
      }),
    );
  },
  /**
   * Save a new order for some tasks. The given tasks swap among the positions
   * they already occupy, so tasks not in the list don't move.
   */
  reorder(ids: string[]) {
    const tasks = getTasks();
    const slots = ids
      .map((id) => tasks.find((t) => t.id === id)?.order)
      .filter((o): o is number => typeof o === "number")
      .sort((a, b) => a - b);
    if (slots.length !== ids.length) return;
    const next = new Map(ids.map((id, i) => [id, slots[i]]));
    save(tasks.map((t) => (next.has(t.id) ? { ...t, order: next.get(t.id)! } : t)));
  },
  /** Add a subtask at the end of a task's list. */
  addSubtask(
    taskId: string,
    input: { title: string; assignee?: string; priority?: PriorityId; schedule?: Schedule },
  ) {
    const title = input.title.trim();
    if (!title) return;
    if (input.schedule && !isValidSchedule(input.schedule)) return;
    const sub: Subtask = {
      id: newId(),
      title,
      done: false,
      createdAt: Date.now(),
      ...(input.assignee ? { assignee: input.assignee } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.schedule ?? {}),
    };
    editSubtasks(taskId, (list) => [...list, sub]);
  },
  toggleSubtask(taskId: string, subId: string) {
    editSubtasks(taskId, (list) => list.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)));
  },
  /** Change a subtask's title, assignee or priority. An undefined assignee or priority clears it. */
  updateSubtask(taskId: string, subId: string, patch: SubtaskPatch) {
    const next = { ...patch };
    if (next.title !== undefined) {
      next.title = next.title.trim();
      if (!next.title) delete next.title;
    }
    editSubtasks(taskId, (list) =>
      list.map((s) => {
        if (s.id !== subId) return s;
        const merged: Subtask = { ...s, ...next };
        if ("assignee" in next && !next.assignee) delete merged.assignee;
        if ("priority" in next && !next.priority) delete merged.priority;
        return merged;
      }),
    );
  },
  /** Set a subtask's start and end together, or pass null to remove them. */
  setSubtaskSchedule(taskId: string, subId: string, schedule: Schedule | null) {
    if (schedule && !isValidSchedule(schedule)) return;
    editSubtasks(taskId, (list) =>
      list.map((s) => {
        if (s.id !== subId) return s;
        const { start: _s, end: _e, ...rest } = s;
        void _s;
        void _e;
        return schedule ? { ...rest, start: schedule.start, end: schedule.end } : rest;
      }),
    );
  },
  deleteSubtask(taskId: string, subId: string) {
    editSubtasks(taskId, (list) => list.filter((s) => s.id !== subId));
  },
  /** Move every task with one tag to another (used when a custom tag is deleted). */
  retag(from: TagId, to: TagId) {
    const tasks = getTasks();
    if (tasks.some((t) => t.tag === from)) save(tasks.map((t) => (t.tag === from ? { ...t, tag: to } : t)));
  },
  /** Unassign every task from a person (used when they're removed from the people list). */
  unassign(personId: string) {
    const tasks = getTasks();
    if (!tasks.some((t) => t.assignee === personId)) return;
    save(
      tasks.map((t) => {
        if (t.assignee !== personId) return t;
        const { assignee: _a, ...rest } = t;
        void _a;
        return rest;
      }),
    );
  },
  /**
   * Add several tasks at once (from an import), at the top of the board in the
   * order given. Titles are trimmed; empty ones and broken timelines are dropped.
   */
  importMany(input: Omit<Task, "id" | "order">[]) {
    const existing = getTasks();
    const top = Math.min(-Date.now(), ...existing.map((t) => t.order)) - input.length - 1;
    const added: Task[] = [];
    input.forEach((t, i) => {
      const title = t.title.trim();
      if (!title) return;
      added.push(normalize({ ...t, title, id: newId(), order: top + i }));
    });
    if (added.length) save([...added, ...existing]);
  },
  /** Move a task to Trash. It can be restored for 30 days. */
  trash(id: string) {
    const now = Date.now();
    save(getTasks().map((t) => (t.id === id ? { ...t, deletedAt: now } : t)));
  },
  /** Move several tasks to Trash at once (a column's or tab's "Delete all"). */
  trashMany(ids: readonly string[]) {
    const now = Date.now();
    const picked = new Set(ids);
    save(getTasks().map((t) => (picked.has(t.id) && t.deletedAt === undefined ? { ...t, deletedAt: now } : t)));
  },
  /** Bring a task back from Trash to the board. */
  restore(id: string) {
    save(
      getTasks().map((t) => {
        if (t.id !== id) return t;
        const { deletedAt: _d, ...rest } = t;
        void _d;
        return rest;
      }),
    );
  },
  /** Delete a task for good. Only offered for tasks already in Trash. */
  deleteForever(id: string) {
    save(getTasks().filter((t) => t.id !== id));
  },
  /** Delete everything in Trash for good. */
  emptyTrash() {
    save(getTasks().filter((t) => t.deletedAt === undefined));
  },
  /** Delete trashed tasks whose 30 days are up (also done on every page load). */
  purgeExpired() {
    const now = Date.now();
    const tasks = getTasks();
    if (tasks.some((t) => isExpired(t, now))) save(tasks.filter((t) => !isExpired(t, now)));
  },
};

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
