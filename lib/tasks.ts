/**
 * Client-side task store backed by localStorage.
 *
 * Read it from React with:
 *   useSyncExternalStore(subscribeTasks, getTasks, getServerTasks)
 * The server snapshot is `null`, meaning "not loaded yet", so the first
 * render matches the server HTML and tasks appear right after hydration.
 */

export const TAGS = [
  { id: "work", label: "Work", chip: "bg-grape/15 text-[#5b2fd1]", dot: "bg-grape" },
  { id: "personal", label: "Personal", chip: "bg-coral/15 text-[#c23a22]", dot: "bg-coral" },
  { id: "team", label: "Team", chip: "bg-skyblue/15 text-[#0b6aa8]", dot: "bg-skyblue" },
  { id: "health", label: "Health", chip: "bg-leaf/15 text-[#0b7a3a]", dot: "bg-leaf" },
  { id: "home", label: "Home", chip: "bg-sunny/25 text-[#8a5a00]", dot: "bg-sunny" },
] as const;

export type TagId = (typeof TAGS)[number]["id"];

export type Task = {
  id: string;
  title: string;
  tag: TagId;
  /** Due date as YYYY-MM-DD (local), if any. */
  due?: string;
  done: boolean;
  createdAt: number;
  doneAt?: number;
};

const KEY = "greenboard.tasks.v1";
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
    typeof t.tag === "string" &&
    TAG_IDS.has(t.tag)
  );
}

function load(): Task[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isTask) : [];
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
  add(input: { title: string; tag: TagId; due?: string }) {
    const title = input.title.trim();
    if (!title) return;
    const task: Task = {
      id: newId(),
      title,
      tag: input.tag,
      due: input.due || undefined,
      done: false,
      createdAt: Date.now(),
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
  remove(id: string) {
    save(getTasks().filter((t) => t.id !== id));
  },
  clearDone() {
    save(getTasks().filter((t) => !t.done));
  },
};

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
