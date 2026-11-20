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
 *
 * The tick column is where ticking a task's circle sends it: Completed by default
 * (the task is done), or any other column but Todo, e.g. "In review". Tasks in it
 * show as ticked; unticking sends them back to Todo.
 *
 * A column can also have its own tick destination (`tickTo`): ticking a task in it
 * sends the task there instead, e.g. In review → QA → Completed.
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

export type Column = {
  id: string;
  label: string;
  color: ColumnColor;
  /** Where ticking a task in this column sends it. Unset: the board's tick column. */
  tickTo?: string;
};
/** A column as the board shows it, with its dot class and whether it's fixed. */
export type BoardColumn = Column & { dot: string; fixed: "first" | "last" | null };

export type Workflow = {
  /** Off: any move is allowed. On: only the moves in `moves`. */
  enabled: boolean;
  /** For each column id, the column ids a task in it may move to. */
  moves: Record<string, string[]>;
};

type Saved = { columns: Column[]; workflow: Workflow; tickColumn: string };

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
  tickColumn: DONE_COLUMN,
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
      columns.push({
        id: c.id,
        label,
        color: COLOR_IDS.has(c.color) ? c.color : "iris",
        ...(typeof c.tickTo === "string" ? { tickTo: c.tickTo } : {}),
      });
    }
  }
  // Todo always exists, and always comes first.
  const todoAt = columns.findIndex((c) => c.id === TODO_COLUMN);
  const todo = todoAt === -1 ? DEFAULTS.columns[0] : columns.splice(todoAt, 1)[0];
  const list = [todo, ...columns.slice(0, MAX_EXTRA_COLUMNS)];
  if (!Array.isArray(r.columns)) list.splice(1, 0, ...DEFAULTS.columns.slice(1));

  const ids = new Set([...list.map((c) => c.id), DONE_COLUMN]);
  // A column's own tick destination must be another column, not Todo (a deleted one is dropped).
  for (let i = 0; i < list.length; i++) {
    const { tickTo, ...rest } = list[i];
    list[i] = tickTo && ids.has(tickTo) && tickTo !== rest.id && tickTo !== TODO_COLUMN ? { ...rest, tickTo } : rest;
  }
  const moves: Record<string, string[]> = {};
  const w = (r.workflow ?? {}) as Partial<Workflow>;
  if (w.moves && typeof w.moves === "object") {
    for (const [from, to] of Object.entries(w.moves)) {
      if (ids.has(from) && Array.isArray(to)) moves[from] = to.filter((id) => typeof id === "string" && ids.has(id) && id !== from);
    }
  }
  // Ticking can send tasks to any column but Todo (a column that's gone falls back to Completed).
  const tickColumn = typeof r.tickColumn === "string" && ids.has(r.tickColumn) && r.tickColumn !== TODO_COLUMN ? r.tickColumn : DONE_COLUMN;
  return { columns: list, workflow: { enabled: w.enabled === true, moves }, tickColumn };
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

/** The column ticking a task sends it to (Completed unless the user picked another). */
export function getTickColumn(): string {
  return read().tickColumn;
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

export function useTickColumn(): string {
  return useSyncExternalStore(subscribe, getTickColumn, () => DONE_COLUMN);
}

/** Where ticking a task in this column sends it: its own destination, or the board's tick column. */
export function tickDestination(columnId: string, columns: BoardColumn[] = getColumns(), tickColumn: string = getTickColumn()): string {
  return columns.find((c) => c.id === columnId)?.tickTo ?? tickColumn;
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
  /** Add a column just before Completed (optionally with where ticking a task in it sends it). Returns its id, or null when full or unnamed. */
  add(label: string, color: ColumnColor, { tickTo }: { tickTo?: string } = {}): string | null {
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
    write({ ...s, columns: [...s.columns, { id, label: name, color, ...(tickTo ? { tickTo } : {}) }], workflow: { ...s.workflow, moves } });
    return id;
  },
  /** Rename or recolour a column, or set where ticking sends its tasks (tickTo: null for the board's default). */
  update(id: string, patch: Partial<Pick<Column, "label" | "color">> & { tickTo?: string | null }) {
    const s = read();
    write({
      ...s,
      columns: s.columns.map((c) => {
        if (c.id !== id) return c;
        const next: Column = {
          ...c,
          ...(patch.label !== undefined && patch.label.trim() ? { label: patch.label.trim().slice(0, MAX_COLUMN_LABEL) } : {}),
          ...(patch.color ? { color: patch.color } : {}),
        };
        if (patch.tickTo === null) delete next.tickTo;
        else if (patch.tickTo) next.tickTo = patch.tickTo;
        return next;
      }),
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
  /** Put the user's columns in this order (Todo stays first, Completed last; unknown ids are ignored). */
  reorder(ids: string[]) {
    const s = read();
    const byId = new Map(s.columns.map((c) => [c.id, c]));
    const middle = ids.filter((id) => id !== TODO_COLUMN && byId.has(id)).map((id) => byId.get(id)!);
    // Any column missing from `ids` keeps its place at the end, so nothing is lost.
    const rest = s.columns.slice(1).filter((c) => !middle.includes(c));
    write({ ...s, columns: [s.columns[0], ...middle, ...rest] });
  },
  /** Delete one of the user's columns (not Todo or Completed). Its tasks should be moved first. */
  remove(id: string) {
    if (id === TODO_COLUMN || id === DONE_COLUMN) return;
    const s = read();
    const moves: Record<string, string[]> = {};
    for (const [from, to] of Object.entries(s.workflow.moves)) {
      if (from !== id) moves[from] = to.filter((x) => x !== id);
    }
    // If ticked tasks went here, they go to Completed again (clean() sees the column is gone).
    write({ ...s, columns: s.columns.filter((c) => c.id !== id), workflow: { ...s.workflow, moves } });
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
  /** Choose where ticking a task sends it (any column but Todo). */
  setTickColumn(id: string) {
    write({ ...read(), tickColumn: id });
  },
  /** Back to Todo → Pending → Completed with no workflow. Tasks in removed columns should be moved first. */
  reset() {
    write(DEFAULTS);
  },
};
