/**
 * The board's columns and its workflow, saved in this browser (localStorage).
 *
 * Columns run left to right: Todo first (where new tasks start), any columns
 * the user adds, and Completed last. Completed is fixed: it's where ticked
 * tasks go, and it can't be renamed, moved or deleted. Todo can be renamed
 * and recoloured but not deleted. Pending is a starter column that works like
 * any added one.
 *
 * The workflow says which columns a task may move to from each column. Off by
 * default (any move is allowed); turned on, only the ticked moves are.
 */

import { useSyncExternalStore } from "react";

/** The fixed first and last columns. */
export const TODO_COLUMN = "todo";
export const DONE_COLUMN = "done";

/** Colours a column can have (its dot on the board). Literal classes so Tailwind keeps them. */
export const COLUMN_COLORS = [
  { id: "iris", label: "Blue", dot: "bg-iris" },
  { id: "peach", label: "Peach", dot: "bg-peach" },
  { id: "sky", label: "Sky", dot: "bg-skyblue" },
  { id: "grape", label: "Purple", dot: "bg-grape" },
  { id: "sunny", label: "Yellow", dot: "bg-sunny" },
  { id: "coral", label: "Coral", dot: "bg-coral" },
  { id: "teal", label: "Teal", dot: "bg-[#14b8a6]" },
] as const;
export type ColumnColor = (typeof COLUMN_COLORS)[number]["id"];
const COLOR_IDS = new Set<string>(COLUMN_COLORS.map((c) => c.id));

export type Column = { id: string; label: string; color: ColumnColor };
/** A column as the board shows it, with its dot class and whether it's fixed. */
export type BoardColumn = Column & { dot: string; fixed: "first" | "last" | null };

export type Workflow = {
  /** Off: any move is allowed. On: only the moves in `moves`. */
  enabled: boolean;
  /** For each column id, the column ids a task in it may move to. */
  moves: Record<string, string[]>;
};

type Saved = { columns: Column[]; workflow: Workflow };

/** Columns the user can add, besides Todo and Completed. */
export const MAX_EXTRA_COLUMNS = 6;
export const MAX_COLUMN_LABEL = 24;

const DONE: BoardColumn = { id: DONE_COLUMN, label: "Completed", color: "teal", dot: "bg-success", fixed: "last" };

const DEFAULTS: Saved = {
  columns: [
    { id: TODO_COLUMN, label: "Todo", color: "iris" },
    { id: "pending", label: "Pending", color: "peach" },
  ],
  workflow: { enabled: false, moves: {} },
};

const KEY = "greenboard.columns.v1";

let cached: Saved | null = null;
let cachedBoard: BoardColumn[] | null = null;
const listeners = new Set<() => void>();

function clean(raw: unknown): Saved {
  const r = (raw ?? {}) as Partial<Saved>;
  const seen = new Set<string>();
  const columns: Column[] = [];
  if (Array.isArray(r.columns)) {
    for (const c of r.columns) {
      if (!c || typeof c.id !== "string" || typeof c.label !== "string" || c.id === DONE_COLUMN || seen.has(c.id)) continue;
      const label = c.label.trim().slice(0, MAX_COLUMN_LABEL);
      if (!label) continue;
      seen.add(c.id);
      columns.push({ id: c.id, label, color: COLOR_IDS.has(c.color) ? c.color : "iris" });
    }
  }
  // Todo always exists, and always comes first.
  const todoAt = columns.findIndex((c) => c.id === TODO_COLUMN);
  const todo = todoAt === -1 ? DEFAULTS.columns[0] : columns.splice(todoAt, 1)[0];
  const list = [todo, ...columns.slice(0, MAX_EXTRA_COLUMNS)];
  if (!Array.isArray(r.columns)) list.splice(1, 0, ...DEFAULTS.columns.slice(1));

  const ids = new Set([...list.map((c) => c.id), DONE_COLUMN]);
  const moves: Record<string, string[]> = {};
  const w = (r.workflow ?? {}) as Partial<Workflow>;
  if (w.moves && typeof w.moves === "object") {
    for (const [from, to] of Object.entries(w.moves)) {
      if (ids.has(from) && Array.isArray(to)) moves[from] = to.filter((id) => typeof id === "string" && ids.has(id) && id !== from);
    }
  }
  return { columns: list, workflow: { enabled: w.enabled === true, moves } };
}

function read(): Saved {
  if (cached) return cached;
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? clean(JSON.parse(raw)) : clean(DEFAULTS);
  } catch {
    cached = clean(DEFAULTS);
  }
  return cached;
}

function write(next: Saved) {
  cached = clean(next);
  cachedBoard = null;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Storage blocked: the change still applies for this visit.
  }
  listeners.forEach((l) => l());
}

function toBoard(saved: Saved): BoardColumn[] {
  return [
    ...saved.columns.map((c) => ({
      ...c,
      dot: COLUMN_COLORS.find((x) => x.id === c.color)?.dot ?? "bg-iris",
      fixed: c.id === TODO_COLUMN ? ("first" as const) : null,
    })),
    DONE,
  ];
}

const SERVER_BOARD = toBoard(DEFAULTS);

/** Every column, left to right: Todo, the user's columns, Completed. */
export function getColumns(): BoardColumn[] {
  if (typeof window === "undefined") return SERVER_BOARD;
  if (!cachedBoard) cachedBoard = toBoard(read());
  return cachedBoard;
}

export function getWorkflow(): Workflow {
  return read().workflow;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cached = null;
    cachedBoard = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The columns, for React. The server (and the first render) sees the defaults. */
export function useBoardColumns(): BoardColumn[] {
  return useSyncExternalStore(subscribe, getColumns, () => SERVER_BOARD);
}

const SERVER_WORKFLOW = DEFAULTS.workflow;
export function useWorkflow(): Workflow {
  return useSyncExternalStore(subscribe, getWorkflow, () => SERVER_WORKFLOW);
}

/** Whether the workflow lets a task move from one column to another. */
export function canMove(from: string, to: string, workflow: Workflow = getWorkflow()): boolean {
  if (from === to || !workflow.enabled) return true;
  return workflow.moves[from]?.includes(to) ?? false;
}

/** A known column id, or Todo for one that no longer exists. */
export function knownColumn(id: string | undefined): string {
  return id && getColumns().some((c) => c.id === id) ? id : TODO_COLUMN;
}

export function columnLabel(id: string): string {
  return getColumns().find((c) => c.id === id)?.label ?? "Todo";
}

/** Every move allowed: what the workflow starts from when it's turned on. */
function allMoves(columns: { id: string }[]): Record<string, string[]> {
  const ids = columns.map((c) => c.id);
  return Object.fromEntries(ids.map((from) => [from, ids.filter((to) => to !== from)]));
}

function newId() {
  return `col-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`;
}

export const columnActions = {
  /** Add a column just before Completed. Returns its id, or null when full or unnamed. */
  add(label: string, color: ColumnColor): string | null {
    const s = read();
    const name = label.trim().slice(0, MAX_COLUMN_LABEL);
    if (!name || s.columns.length - 1 >= MAX_EXTRA_COLUMNS) return null;
    const id = newId();
    const moves = { ...s.workflow.moves };
    if (s.workflow.enabled) {
      // A new column starts reachable from, and able to reach, every column; trim it in the workflow.
      const others = [...s.columns.map((c) => c.id), DONE_COLUMN];
      for (const from of others) moves[from] = [...(moves[from] ?? []), id];
      moves[id] = others;
    }
    write({ columns: [...s.columns, { id, label: name, color }], workflow: { ...s.workflow, moves } });
    return id;
  },
  update(id: string, patch: Partial<Pick<Column, "label" | "color">>) {
    const s = read();
    write({
      ...s,
      columns: s.columns.map((c) =>
        c.id !== id
          ? c
          : {
              ...c,
              ...(patch.label !== undefined && patch.label.trim() ? { label: patch.label.trim().slice(0, MAX_COLUMN_LABEL) } : {}),
              ...(patch.color ? { color: patch.color } : {}),
            },
      ),
    });
  },
  /** Move one of the user's columns left (-1) or right (+1). Todo stays first, Completed last. */
  move(id: string, by: -1 | 1) {
    const s = read();
    const i = s.columns.findIndex((c) => c.id === id);
    const j = i + by;
    if (i < 1 || j < 1 || j >= s.columns.length) return;
    const columns = [...s.columns];
    [columns[i], columns[j]] = [columns[j], columns[i]];
    write({ ...s, columns });
  },
  /** Delete one of the user's columns (not Todo or Completed). Its tasks should be moved first. */
  remove(id: string) {
    if (id === TODO_COLUMN || id === DONE_COLUMN) return;
    const s = read();
    const moves: Record<string, string[]> = {};
    for (const [from, to] of Object.entries(s.workflow.moves)) {
      if (from !== id) moves[from] = to.filter((x) => x !== id);
    }
    write({ columns: s.columns.filter((c) => c.id !== id), workflow: { ...s.workflow, moves } });
  },
  /** Turn the workflow on (starting with every move allowed) or off (keeping the moves for next time). */
  setWorkflowEnabled(enabled: boolean) {
    const s = read();
    const hasMoves = Object.keys(s.workflow.moves).length > 0;
    write({
      ...s,
      workflow: { enabled, moves: enabled && !hasMoves ? allMoves([...s.columns, DONE]) : s.workflow.moves },
    });
  },
  /** Allow or block one move. */
  setMove(from: string, to: string, allowed: boolean) {
    if (from === to) return;
    const s = read();
    const current = new Set(s.workflow.moves[from] ?? []);
    if (allowed) current.add(to);
    else current.delete(to);
    write({ ...s, workflow: { ...s.workflow, moves: { ...s.workflow.moves, [from]: [...current] } } });
  },
  /** Back to Todo → Pending → Completed with no workflow. Tasks in removed columns should be moved first. */
  reset() {
    write(DEFAULTS);
  },
};
