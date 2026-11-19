/**
 * What the sidebar and the board share, so the sidebar can stay put across the
 * workspace pages (/board, /settings, /help) and keep its state as you move between them:
 * the board view, tag, search and filters, and whether the phone menu is open.
 *
 * Kept in memory for the visit (a reload starts fresh, like before).
 *
 * Board-only actions (open Trash, edit a tag, …) go through requestBoard(): the
 * board handles them right away when it's showing, otherwise they wait until
 * the board has opened.
 */

import { useSyncExternalStore } from "react";
import type { TagId } from "./tasks";
import type { CustomTag, TagView } from "./tags";

export type View = "board" | "today" | "upcoming";
/** The phone tab: a column id (see lib/columns.ts), "todo" by default. */
export type Filter = string;
/** "any" shows every task; "none" only tasks without one. */
export type PriorityFilter = "any" | "none" | "urgent" | "high" | "medium" | "low";
/** "any", "none" (unassigned), or a person's id ("me", "person-…"). */
export type AssigneeFilter = string;
/** Sidebar destinations. "completed" and "trash" are shortcuts handled by the board. */
export type NavTarget = "board" | "today" | "upcoming" | "completed" | "trash";

export type WorkspaceState = {
  view: View;
  filter: Filter;
  tag: TagId | null;
  query: string;
  priority: PriorityFilter;
  assignee: AssigneeFilter;
  /** The phone menu (the sidebar as a slide-out panel). */
  menuOpen: boolean;
};

const INITIAL: WorkspaceState = {
  view: "board",
  filter: "todo",
  tag: null,
  query: "",
  priority: "any",
  assignee: "any",
  menuOpen: false,
};

let state = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<WorkspaceState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

/** Phones get the board's tabbed list; columns start at Tailwind's md breakpoint (768px). */
const COLUMNS_QUERY = "(min-width: 768px)";
function subscribeColumns(onChange: () => void) {
  const mq = window.matchMedia(COLUMNS_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
/** True when the board shows two columns (the server assumes it does). */
export function useColumns() {
  return useSyncExternalStore(subscribeColumns, () => window.matchMedia(COLUMNS_QUERY).matches, () => true);
}

export const workspace = {
  setView: (view: View) => set({ view }),
  setFilter: (filter: Filter) => set({ filter }),
  setTag: (tag: TagId | null) => set({ tag }),
  setQuery: (query: string) => set({ query }),
  setPriority: (priority: PriorityFilter) => set({ priority }),
  setAssignee: (assignee: AssigneeFilter) => set({ assignee }),
  setMenuOpen: (menuOpen: boolean) => set({ menuOpen }),
};

/* ───────────────────────── Board actions ───────────────────────── */

export type BoardAction =
  | { type: "navigate"; target: NavTarget }
  | { type: "editTag"; tag: CustomTag | null }
  | { type: "deleteTag"; tag: TagView };

type BoardHandler = (action: BoardAction) => void;

let board: BoardHandler | null = null;
let pending: BoardAction[] = [];

/** The board calls this when it mounts; actions asked for before then run now. */
export function registerBoard(handler: BoardHandler) {
  board = handler;
  const queued = pending;
  pending = [];
  queued.forEach(handler);
  return () => {
    if (board === handler) board = null;
  };
}

/**
 * Run a board action: now if the board is showing, otherwise once it opens.
 * Returns false when the board isn't showing, so the caller can go to /board.
 */
export function requestBoard(action: BoardAction): boolean {
  if (board) {
    board(action);
    return true;
  }
  pending.push(action);
  return false;
}
