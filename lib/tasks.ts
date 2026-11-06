/**
 * Client-side task store backed by localStorage.
 *
 * Read it from React with:
 *   useSyncExternalStore(subscribeTasks, getTasks, getServerTasks)
 * The server snapshot is `null`, meaning "not loaded yet", so the first
 * render matches the server HTML and tasks appear right after hydration.
 */

export const TAGS = [
  { id: "default", label: "Default", chip: "bg-ink/10 text-ink/75", dot: "bg-ink/40" },
  { id: "work", label: "Work", chip: "bg-grape/15 text-[#5b2fd1]", dot: "bg-grape" },
  { id: "personal", label: "Personal", chip: "bg-coral/15 text-[#c23a22]", dot: "bg-coral" },
  { id: "team", label: "Team", chip: "bg-skyblue/15 text-[#0b6aa8]", dot: "bg-skyblue" },
  { id: "health", label: "Health", chip: "bg-[#22c55e]/15 text-[#15803d]", dot: "bg-[#22c55e]" },
  { id: "home", label: "Home", chip: "bg-sunny/25 text-[#8a5a00]", dot: "bg-sunny" },
] as const;

export type TagId = (typeof TAGS)[number]["id"];

/** Tag preselected for new tasks, and the fallback for unknown tags. */
export const DEFAULT_TAG: TagId = "default";

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
};

export type TaskPatch = Partial<Pick<Task, "title" | "tag" | "description" | "descriptionText">>;

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
const TAG_IDS = new Set<string>(TAGS.map((t) => t.id));

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
    typeof t.tag === "string" &&
    TAG_IDS.has(t.tag) &&
    (t.description === undefined || typeof t.description === "string") &&
    (t.descriptionText === undefined || typeof t.descriptionText === "string")
  );
}

/**
 * Fill in defaults for tasks saved by older versions, and drop a half-set or
 * invalid schedule rather than keeping a broken one.
 */
function normalize(t: Task): Task {
  // Tasks saved before reordering existed keep their newest-first position.
  if (typeof t.order !== "number") t = { ...t, order: -t.createdAt };
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

export const taskActions = {
  add(input: { title: string; tag: TagId; schedule?: Schedule }) {
    const title = input.title.trim();
    if (!title) return;
    if (input.schedule && !isValidSchedule(input.schedule)) return;
    const task: Task = {
      id: newId(),
      title,
      tag: input.tag,
      ...(input.schedule ?? {}),
      done: false,
      createdAt: Date.now(),
      // Ahead of every existing task, so new tasks appear at the top.
      order: Math.min(-Date.now(), ...getTasks().map((t) => t.order - 1)),
    };
    save([task, ...getTasks()]);
  },
  toggle(id: string) {
    save(
      getTasks().map((t) =>
        t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() } : t,
      ),
    );
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
  /** Move a task to Trash. It can be restored for 30 days. */
  trash(id: string) {
    const now = Date.now();
    save(getTasks().map((t) => (t.id === id ? { ...t, deletedAt: now } : t)));
  },
  /** Move every completed task (not already in Trash) to Trash. */
  trashDone() {
    const now = Date.now();
    save(getTasks().map((t) => (t.done && t.deletedAt === undefined ? { ...t, deletedAt: now } : t)));
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
