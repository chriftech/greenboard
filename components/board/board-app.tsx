"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowRight,
  Menu,
  CalendarClock,
  CircleCheck,
  CircleDashed,
  CircleDot,
  ClipboardCheck,
  GripVertical,
  ListTree,
  X,
  NotebookPen,
  PartyPopper,
  Plus,
  Trash2,
  Ellipsis,
  ChevronsLeftRight,
  ChevronsRightLeft,
} from "lucide-react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { setColumnCollapsed, useCollapsedColumns } from "@/lib/collapsed-columns";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DraggableAttributes,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Logo } from "@/components/landing/logo";
import { CheckBox, ConfettiBurst } from "@/components/landing/check-box";
import { TaskDetails, preloadTaskEditor } from "./task-details";
import { CreateTaskDialog, InlineAddTask, NewTaskButton, useStartColumns } from "./add-task";
import { ConfirmDialog } from "./confirm-dialog";
import { TagEditor } from "./tag-editor";
import { TagChip, TagDot } from "./tag-chip";
import { AssigneeBadge, PriorityChip } from "./task-meta";
import { CardSubtasks, SubtaskToggle } from "./subtasks";
import { findTag, tagActions, useTags, type CustomTag, type TagView } from "@/lib/tags";
import { TrashPanel } from "./trash-panel";
import { Tour } from "./tour";
import { hasSeenTour, tourActions } from "@/lib/tour";
import { useSettings } from "@/lib/settings";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileMenu } from "./profile-menu";
import { BoardToolbar } from "./board-toolbar";
import { ImportDialog } from "./import-dialog";
import { AddColumnButton } from "./add-column";
import { usePeople } from "@/lib/people";
import { registerBoard, useWorkspace, workspace, type Filter, type NavTarget, type View } from "@/lib/workspace";
import { GreetingSkeleton, TaskBoardSkeleton } from "./board-skeleton";
import {
  formatSchedule,
  isScheduledToday,
  isUpcoming,
  scheduleStatus,
} from "./schedule";
import {
  TRASH_DAYS,
  getServerTasks,
  getTasks,
  isTicked,
  statusOf,
  subscribeTasks,
  tickTarget,
  taskActions,
  type TagId,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";
import {
  DONE_COLUMN,
  TODO_COLUMN,
  canMove,
  useBoardColumns,
  useTickColumn,
  useWorkflow,
  type BoardColumn as ColumnDef,
} from "@/lib/columns";

/** The board's columns: Todo, the user's columns, Completed (see lib/columns.ts). */
type ColumnId = TaskStatus;
/** Which column a "Delete all" empties. */
type DeleteAllList = ColumnId;
/** Destructive actions waiting for confirmation. */
type PendingDelete =
  | { kind: "task"; id: string; title: string } // move one task to Trash
  | { kind: "all"; ids: string[]; list: DeleteAllList; label: string; narrowed: boolean } // move every task shown in a column or tab to Trash
  | { kind: "forever"; id: string; title: string } // delete one trashed task for good
  | { kind: "empty"; count: number } // delete everything in Trash for good
  | { kind: "tag"; id: string; label: string; count: number }; // delete a custom tag

function confirmCopy(p: PendingDelete | null) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  switch (p?.kind) {
    case "all": {
      const n = p.ids.length;
      const kind = p.label ? `${p.label.toLowerCase()} task` : "task";
      return {
        title: n === 1 ? `Move 1 ${kind} to Trash?` : `Move all ${plural(n, kind)} to Trash?`,
        description: `${p.narrowed ? "Only the tasks shown with your current filters are included. " : ""}You can restore ${n === 1 ? "it" : "them"} from Trash for ${TRASH_DAYS} days. After that ${n === 1 ? "it's" : "they're"} deleted for good.`,
        confirmLabel: "Move to Trash",
      };
    }
    case "forever":
      return {
        title: "Delete forever?",
        description: (
          <>
            <span className="font-semibold text-ink">&ldquo;{p.title}&rdquo;</span> and its description will be
            deleted for good. This can&apos;t be undone.
          </>
        ),
        confirmLabel: "Delete forever",
      };
    case "tag":
      return {
        title: `Delete the “${p.label}” tag?`,
        description:
          p.count === 0
            ? "No tasks use it. This can't be undone."
            : `${plural(p.count, "task")} with this tag will move to Default. This can't be undone.`,
        confirmLabel: "Delete tag",
      };
    case "empty":
      return {
        title: "Empty Trash?",
        description: `${plural(p.count, "task")} will be deleted for good. This can't be undone.`,
        confirmLabel: "Empty Trash",
      };
    default:
      return {
        title: "Move this task to Trash?",
        description: (
          <>
            <span className="font-semibold text-ink">&ldquo;{p?.title}&rdquo;</span> will move to Trash. You can
            restore it for {TRASH_DAYS} days, then it&apos;s deleted for good.
          </>
        ),
        confirmLabel: "Move to Trash",
      };
  }
}
/** How long a ticked task pauses in place before moving to the Completed group. */
const MOVE_DELAY_MS = 50;
/** The progress bar fills faster than the pause, so it's full just before the task moves. */
const MOVE_PROGRESS_MS = 350;

/** Droppable id for a column itself (tasks use their own ids). */
const dropId = (col: ColumnId) => `col-${col}`;

/**
 * Drop on the task under the pointer if there is one, else on the column
 * under it (so empty columns and the space below the last task accept drops).
 * Keyboard drags have no pointer, so they fall back to the nearest target.
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const onTasks = hits.filter((h) => !String(h.id).startsWith("col-"));
  if (onTasks.length) return onTasks;
  return hits.length ? hits : closestCenter(args);
};

/**
 * Each column's colours: a solid status pill in its header and a faint wash behind its tasks.
 * Literal classes so Tailwind keeps them. Completed always uses the success green.
 */
const COLUMN_STYLES: Record<string, { pill: string; wash: string; ring: string }> = {
  iris: { pill: "bg-iris text-white", wash: "bg-iris/[0.06]", ring: "outline-iris/50" },
  peach: { pill: "bg-peach text-on-accent", wash: "bg-peach/[0.14]", ring: "outline-peach" },
  sky: { pill: "bg-skyblue text-on-accent", wash: "bg-skyblue/[0.08]", ring: "outline-skyblue/60" },
  grape: { pill: "bg-grape text-white", wash: "bg-grape/[0.07]", ring: "outline-grape/50" },
  sunny: { pill: "bg-sunny text-on-accent", wash: "bg-sunny/[0.12]", ring: "outline-sunny" },
  coral: { pill: "bg-coral text-on-accent", wash: "bg-coral/[0.07]", ring: "outline-coral/50" },
  teal: { pill: "bg-[#14b8a6] text-white", wash: "bg-[#14b8a6]/[0.07]", ring: "outline-[#14b8a6]/50" },
  done: { pill: "bg-success text-white", wash: "bg-success/[0.07]", ring: "outline-success/50" },
};
const columnStyle = (c: ColumnDef) => COLUMN_STYLES[c.id === DONE_COLUMN ? "done" : c.color] ?? COLUMN_STYLES.iris;
/** Todo is waiting, Completed is done, anything between is in progress. */
const ColumnIcon = ({ c }: { c: ColumnDef }) => {
  const Icon = c.id === TODO_COLUMN ? CircleDashed : c.id === DONE_COLUMN ? CircleCheck : CircleDot;
  return <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />;
};

export function BoardApp() {
  const { showGreeting } = useSettings();
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  // View, tag, search and filters live in the workspace store, shared with the sidebar
  // (which stays on screen across /board, /settings and /help).
  const { view, tag, query, priority, assignee: assigneeFilter } = useWorkspace();
  const { setView, setTag, setQuery, setPriority, setAssignee: setAssigneeFilter } = workspace;
  // The user's columns (Settings), and which moves between them the workflow allows.
  const boardColumns = useBoardColumns();
  const workflow = useWorkflow();
  const tickColumn = useTickColumn();
  const columnIds = boardColumns.map((c) => c.id);
  const labelOf = (col: ColumnId) => boardColumns.find((c) => c.id === col)?.label ?? "Todo";
  // A short visible note when the workflow blocks a move.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  function blockMove(from: ColumnId, to: ColumnId) {
    const text = `Your workflow doesn't allow moving from ${labelOf(from)} to ${labelOf(to)}.`;
    setNotice(text);
    setAnnouncement(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }
  const people = usePeople();
  const [importOpen, setImportOpen] = useState(false);
  // The "Create task" window (the Task button, or T).
  const [createOpen, setCreateOpen] = useState(false);
  const startColumns = useStartColumns();
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== "t" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target instanceof Element ? e.target : null;
      // Not while typing, or while a dialog or menu is open.
      if (el?.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return;
      if (document.querySelector("[role=dialog][data-open], [role=alertdialog][data-open]")) return;
      e.preventDefault();
      setCreateOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const tags = useTags();
  // Tag editor: null = creating a new tag. Kept after closing so the dialog can animate out.
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  // A filter on a tag that was since deleted shows nothing; treat it as no filter.
  const activeTag = tag && tags.some((t) => t.id === tag) ? tag : null;
  // Likewise for a person who was since removed.
  const activeAssignee =
    assigneeFilter === "any" || assigneeFilter === "none" || assigneeFilter === "me" || people.some((p) => p.id === assigneeFilter)
      ? assigneeFilter
      : "any";
  // Keep the selected id after closing so the panel can animate out with its content.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loaded = tasks !== null;
  const selected = tasks?.find((t) => t.id === selectedId) ?? null;

  // The guided tour starts by itself on a first visit, and from /board?tour (the Help page's link).
  useEffect(() => {
    if (!loaded) return;
    const url = new URL(window.location.href);
    const asked = url.searchParams.has("tour");
    if (asked) {
      url.searchParams.delete("tour");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    if (!asked && hasSeenTour()) return;
    // Let the board's entrance animation settle first, so the spotlight lands in the right place.
    const timer = window.setTimeout(tourActions.start, 900);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  // Fetch the description editor once the board is idle, so opening a task doesn't wait for it.
  useEffect(() => {
    if (!loaded) return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preloadTaskEditor, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(preloadTaskEditor, 2000);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  function openDetails(id: string) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  // Every delete goes through one confirmation dialog. `pending` is kept after
  // closing so the dialog's text doesn't change while it animates out.
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Ticked tasks pause where they are for a moment ("Moving to Completed"),
  // then move into the Completed group and get a brief highlight there.
  // Maps each pausing task to the column it's pausing in (Todo or Pending).
  const [moving, setMoving] = useState<ReadonlyMap<string, ColumnId>>(() => new Map());
  const [landed, setLanded] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const moveTimers = useRef(new Map<string, number>());

  useEffect(() => {
    const timers = moveTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  function stopMoving(id: string) {
    window.clearTimeout(moveTimers.current.get(id));
    moveTimers.current.delete(id);
    setMoving((s) => {
      const next = new Map(s);
      next.delete(id);
      return next;
    });
  }

  // The Completed column's count: where the "done" bubble flies to.
  const completedCountRef = useRef<HTMLSpanElement>(null);
  // A column briefly highlighted after the sidebar points at it, or just after it's added.
  const [flash, setFlash] = useState<ColumnId | null>(null);
  // While dragging: which task, and which column it's over.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);

  /** Scroll a column into view and highlight it for a moment. */
  function showColumn(id: ColumnId) {
    // A collapsed column opens up, so there's something to see.
    setColumnCollapsed(id, false);
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1400);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() =>
      document
        .querySelector(`[data-column="${window.CSS.escape(id)}"]`)
        ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest", inline: "nearest" }),
    );
  }

  /** A small ✓ bubble arcs from the ticked checkbox into the Completed column's count, which bumps. */
  function flyToCompleted(from: DOMRect) {
    const target = completedCountRef.current;
    if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = target.getBoundingClientRect();
    const half = 11; // bubble is 22px
    const x0 = from.left + from.width / 2 - half;
    const y0 = from.top + from.height / 2 - half;
    const x1 = to.left + to.width / 2 - half;
    const y1 = to.top + to.height / 2 - half;
    const peakY = Math.min(y0, y1) - 60;

    const bubble = document.createElement("div");
    bubble.className = "gb-fly-bubble";
    bubble.setAttribute("aria-hidden", "true");
    bubble.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    document.body.appendChild(bubble);

    const flight = bubble.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.3)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 14}px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${(x0 + x1) / 2}px, ${peakY}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.5)`, opacity: 0.85 },
      ],
      { duration: 750, easing: "cubic-bezier(0.45, 0, 0.35, 1)" },
    );
    const land = () => {
      bubble.remove();
      target.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.5)" }, { transform: "scale(1)" }],
        { duration: 380, easing: "ease-out" },
      );
    };
    flight.onfinish = land;
    flight.oncancel = () => bubble.remove();
  }

  // Ticking sends a task to its column's destination (Completed unless changed in Settings); unticking, back to Todo.
  function toggleTask(task: Task, origin?: DOMRect) {
    const nowTicked = !isTicked(task, tickColumn);
    const from = statusOf(task);
    const to = tickTarget(task, tickColumn, boardColumns);
    if (!canMove(from, to, workflow)) return blockMove(from, to);
    taskActions.toggle(task.id);
    if (nowTicked && to === DONE_COLUMN && origin) flyToCompleted(origin);
    if (!nowTicked) return stopMoving(task.id); // unticked during the pause: stay put
    setMoving((s) => new Map(s).set(task.id, from));
    moveTimers.current.set(
      task.id,
      window.setTimeout(() => {
        stopMoving(task.id);
        setLanded(task.id);
        setAnnouncement(`"${task.title}" moved to ${labelOf(to)}.`);
        window.setTimeout(() => setLanded((l) => (l === task.id ? null : l)), 1100);
      }, MOVE_DELAY_MS),
    );
  }
  const [trashOpen, setTrashOpen] = useState(false);

  function openTrash() {
    setTrashOpen(true);
  }

  function askDelete(next: PendingDelete) {
    setPending(next);
    setConfirmOpen(true);
  }

  function confirmDelete() {
    if (!pending) return;
    switch (pending.kind) {
      case "all":
        if (selectedId && pending.ids.includes(selectedId)) setDetailsOpen(false);
        return taskActions.trashMany(pending.ids);
      case "forever":
        return taskActions.deleteForever(pending.id);
      case "empty":
        return taskActions.emptyTrash();
      case "tag":
        if (tag === pending.id) setTag(null);
        return tagActions.remove(pending.id);
      case "task": {
        const id = pending.id;
        if (selectedId === id) setDetailsOpen(false);
        setRemovingId(id); // play the row's exit animation first
        setTimeout(() => {
          taskActions.trash(id);
          setRemovingId(null);
        }, 250);
      }
    }
  }
  // Trashed tasks are hidden from the board and only listed in the Trash panel.
  const all = (tasks ?? []).filter((t) => t.deletedAt === undefined);
  const trashed = (tasks ?? []).filter((t) => t.deletedAt !== undefined);

  // Narrow the board by the sidebar's view, tag and search.
  const q = query.trim().toLowerCase();
  const inView = (t: Task, v: View) => {
    if (v === "board") return true;
    if (!t.start || !t.end) return false;
    const timeline = { start: t.start, end: t.end };
    return v === "today" ? isScheduledToday(timeline) : isUpcoming(timeline);
  };
  const matches = (t: Task) =>
    inView(t, view) &&
    (!activeTag || t.tag === activeTag) &&
    (priority === "any" || (priority === "none" ? !t.priority : t.priority === priority)) &&
    (activeAssignee === "any" || (activeAssignee === "none" ? !t.assignee : t.assignee === activeAssignee)) &&
    (!q || t.title.toLowerCase().includes(q) || (t.descriptionText ?? "").toLowerCase().includes(q));
  const scoped = all.filter(matches);
  // What the sidebar narrowed (shown as chips), and everything that narrows the board.
  const sidebarNarrowed = view !== "board" || activeTag !== null || q !== "";
  const narrowed = sidebarNarrowed || priority !== "any" || activeAssignee !== "any";
  /** Ask to move every task shown in a column or tab to Trash. */
  const askDeleteAll = (list: DeleteAllList, tasks: Task[]) =>
    askDelete({ kind: "all", ids: tasks.map((t) => t.id), list, label: labelOf(list), narrowed });

  // Tasks that are mid-move stay in the column they were ticked in until their pause ends.
  const shownIn = (t: Task) => moving.get(t.id) ?? statusOf(t);
  const columns: Record<ColumnId, Task[]> = Object.fromEntries(columnIds.map((c) => [c, [] as Task[]]));
  scoped.forEach((t) => (columns[shownIn(t)] ?? columns[TODO_COLUMN]).push(t));
  // Counts change as soon as a task is ticked, before it slides across.
  const counts: Record<ColumnId, number> = Object.fromEntries(columnIds.map((c) => [c, 0]));
  scoped.forEach((t) => (counts[statusOf(t)] = (counts[statusOf(t)] ?? 0) + 1));

  // My board: each column in the order the user dragged it into.
  // Today/Upcoming: soonest start first, and not draggable.
  const byOrder = (a: Task, b: Task) => a.order - b.order;
  const byStart = (a: Task, b: Task) => (a.start ?? "").localeCompare(b.start ?? "") || byOrder(a, b);
  const sortable = view === "board";
  Object.values(columns).forEach((list) => list.sort(sortable ? byOrder : byStart));

  function navigate(target: NavTarget) {
    switch (target) {
      case "trash":
        return openTrash();
      case "completed":
        // Bring the Completed column into view and highlight it.
        setView("board");
        return showColumn(DONE_COLUMN);
      case "board":
        // "My board" is the reset: unfiltered.
        clearFilters();
        setQuery("");
        return setView("board");
      default:
        return setView(target);
    }
  }

  function clearFilters() {
    setTag(null);
    setPriority("any");
    setAssigneeFilter("any");
  }

  function clearNarrowing() {
    setView("board");
    setQuery("");
    clearFilters();
  }

  // Pending tasks, for the greeting card.
  const pendingAll = all.filter((t) => !t.done);
  // The sidebar (in the workspace layout) sends its board actions here, including
  // ones asked for on another page before the board opened.
  const actions = useRef<{
    navigate: (target: NavTarget) => void;
    editTag: (tag: CustomTag | null) => void;
    deleteTag: (tag: TagView) => void;
    openTask: (id: string) => void;
  } | null>(null);
  actions.current = {
    navigate,
    openTask: openDetails,
    editTag: (t) => {
      setEditingTag(t);
      setTagEditorOpen(true);
    },
    deleteTag: (t) =>
      askDelete({
        kind: "tag",
        id: t.id,
        label: t.label,
        // Every task (Trash included) carrying the tag moves to Default.
        count: (tasks ?? []).filter((x) => x.tag === t.id).length,
      }),
  };
  useEffect(
    () =>
      registerBoard((action) => {
        const run = actions.current;
        if (!run) return;
        if (action.type === "navigate") run.navigate(action.target);
        else if (action.type === "editTag") run.editTag(action.tag);
        else if (action.type === "openTask") run.openTask(action.id);
        else run.deleteTag(action.tag);
      }),
    [],
  );

  // Drag starts after a small move (mouse) or a short press (touch), so clicks
  // and scrolling still work; the grip handle supports keyboard reordering.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const titleOf = (id: UniqueIdentifier) => `"${all.find((t) => t.id === id)?.title ?? "task"}"`;

  const columnOf = (id: UniqueIdentifier): ColumnId | null => {
    const key = String(id);
    return columnIds.find((c) => key === dropId(c) || columns[c].some((t) => t.id === key)) ?? null;
  };
  const activeTask = activeId ? all.find((t) => t.id === activeId) ?? null : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverColumn(over ? columnOf(over.id) : null);
  }

  function endDrag() {
    setActiveId(null);
    setOverColumn(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    endDrag();
    if (!over) return;
    const id = String(active.id);
    const from = columnOf(active.id);
    const to = columnOf(over.id);
    if (!from || !to) return;
    const overTask = String(over.id) !== dropId(to) ? String(over.id) : null;

    if (from === to) {
      // Reorder within the column; dropping on the column's empty space moves it to the end.
      const ids = columns[from].map((t) => t.id);
      const target = overTask ? ids.indexOf(overTask) : ids.length - 1;
      if (target === -1 || target === ids.indexOf(id)) return;
      taskActions.reorder(arrayMove(ids, ids.indexOf(id), target));
      return;
    }

    // Across columns: give it that column's status, placed where it was dropped (if the workflow allows it).
    if (!canMove(from, to, workflow)) return blockMove(from, to);
    const ids = columns[to].map((t) => t.id);
    const at = overTask ? ids.indexOf(overTask) : -1;
    ids.splice(at === -1 ? ids.length : at, 0, id);
    taskActions.setStatus(id, to);
    taskActions.reorder(ids);
    const title = all.find((t) => t.id === id)?.title ?? "Task";
    setAnnouncement(`"${title}" moved to ${labelOf(to)}.`);
    if (to === DONE_COLUMN) {
      setLanded(id);
      window.setTimeout(() => setLanded((l) => (l === id ? null : l)), 1100);
    }
  }

  const workflowNotice = notice ? (
    <p role="status" className="gb-pop mb-4 flex items-center gap-2 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-2.5 text-sm font-medium text-ink">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-coral" />
      {notice}
    </p>
  ) : null;

  // A column just added from the board: bring it into view.
  const showNewColumn = (id: string) => showColumn(id);

  return (
    <>
      {/* `isolate` lets the grid below sit behind the content (-z-10) without dropping under the page background. */}
      <div className="relative isolate min-w-0 flex-1 overflow-x-clip">
        {/*
          Full-screen backdrop, fixed so it stays put while the board scrolls.
          Dark mode only: the light theme keeps a plain white page, like ClickUp.
          It sits behind the sidebar (z-30) and the content (positioned later).
        */}
        <div aria-hidden className="pointer-events-none fixed inset-0 hidden overflow-hidden dark:block">
          <div className="gb-blob absolute -top-48 left-[22%] size-[560px] rounded-full bg-peach/35 blur-3xl dark:bg-peach/10" />
          <div
            className="gb-blob absolute -right-40 top-1/4 size-[460px] rounded-full bg-skyblue/20 blur-3xl"
            style={{ animationDelay: "-7s" }}
          />
          <div
            className="gb-blob absolute -bottom-56 left-[38%] size-[520px] rounded-full bg-iris/15 blur-3xl"
            style={{ animationDelay: "-13s" }}
          />
        </div>
  
        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 pt-6 lg:justify-end">
          {/* The sidebar shows the logo from md up. */}
          <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
            <Logo />
            <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => workspace.setMenuOpen(true)}
              aria-label="Open menu"
              data-tour="menu"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-surface hover:text-ink sm:px-3 lg:hidden"
            >
              <Menu className="size-4" />
              <span className="hidden sm:inline">Menu</span>
            </button>
            <span data-tour="theme" className="inline-flex">
              <ThemeToggle />
            </span>
            <ProfileMenu onStartTour={tourActions.start} />
          </div>
        </header>
  
        <main className="relative pb-24 pt-8 md:pb-8">
          <div className="relative">
            {/*
              The grid scrolls with the page: full strength behind the header, fading out by the
              time the task columns start (it reaches up past the header and down to the board).
            */}
            <div aria-hidden className="gb-grid-bg gb-grid-fade pointer-events-none absolute inset-x-0 -top-40 -bottom-10 -z-10" />
            <div className="mx-auto max-w-7xl px-4">
              {/* The greeting card can be turned off in Settings (which, like the tasks, is only known once loaded). */}
              {!loaded ? (
                <GreetingSkeleton />
              ) : (
                showGreeting && <Summary total={all.length} doneCount={all.length - pendingAll.length} />
              )}

              {/* What the sidebar has narrowed the board to */}
              {sidebarNarrowed && (
                <div className="mt-10 flex flex-wrap items-center gap-2" aria-live="polite">
                  <span className="text-xs font-semibold uppercase tracking-widest text-ink/45">Showing</span>
                  {view !== "board" && (
                    <FilterChip label={view === "today" ? "Today" : "Upcoming"} onClear={() => setView("board")} />
                  )}
                  {activeTag && (
                    <FilterChip label={findTag(tags, activeTag).label} tag={findTag(tags, activeTag)} onClear={() => setTag(null)} />
                  )}
                  {q && <FilterChip label={`“${query.trim()}”`} onClear={() => setQuery("")} />}
                  <button
                    type="button"
                    onClick={clearNarrowing}
                    className="text-xs font-semibold text-ink/50 underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}

            </div>

          </div>

          {/* The board: one column per status, side by side. More than fit scroll sideways (one at a time on phones). */}
          <section
            aria-label="Task board"
            className={`mx-auto max-w-7xl px-4 ${sidebarNarrowed ? "mt-5" : "mt-10"}`}
          >
            {/* Filters on the left, Export on the far right, above the columns.
                On wider screens they stay pinned to the top while a long column scrolls the page. */}
            {loaded && (
              <div className="z-20 -mx-4 mb-4 bg-paper/85 px-4 py-3 backdrop-blur-xl md:sticky md:top-0">
              <BoardToolbar
                empty={all.length === 0}
                onImport={() => setImportOpen(true)}
                addColumn={
                  <>
                    <AddColumnButton onAdded={showNewColumn} />
                    <NewTaskButton onClick={() => setCreateOpen(true)} />
                  </>
                }
                tags={tags}
                people={people}
                tag={activeTag}
                onTagChange={setTag}
                priority={priority}
                onPriorityChange={setPriority}
                assignee={activeAssignee}
                onAssigneeChange={setAssigneeFilter}
                onClear={clearFilters}
              />
              </div>
            )}
            {!loaded ? (
              <TaskBoardSkeleton />
            ) : scoped.length === 0 && narrowed ? (
              <div>
                <EmptyState
                  filter={null}
                  filterLabel=""
                  total={all.length}
                  view={view}
                  narrowed={narrowed}
                  onClear={clearNarrowing}
                />
              </div>
            ) : (
              <DndContext
                id="task-board"
                sensors={sensors}
                collisionDetection={collision}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={endDrag}
                accessibility={{
                  screenReaderInstructions: {
                    draggable:
                      "To move a task, press space or enter to pick it up, use the arrow keys to move it within or between the columns, then space or enter to drop it. Press escape to cancel.",
                  },
                  announcements: {
                    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
                    onDragOver: ({ active, over }) =>
                      over
                        ? String(over.id).startsWith("col-")
                          ? `${titleOf(active.id)} is over the ${labelOf(columnOf(over.id) ?? TODO_COLUMN)} column.`
                          : `${titleOf(active.id)} is over ${titleOf(over.id)}.`
                        : `${titleOf(active.id)} is not over a column.`,
                    onDragEnd: ({ active, over }) =>
                      over ? `${titleOf(active.id)} dropped.` : `${titleOf(active.id)} was not moved.`,
                    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
                  },
                }}
              >
                {workflowNotice}
                {/* Fixed-width columns in a row: the page never squeezes them, it scrolls sideways instead.
                    Phones snap one column at a time, with the next one peeking in. */}
                <div
                  data-tour="columns"
                  className="gb-column-scroll -mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-3 overflow-x-auto px-4 pb-3 md:snap-none"
                >
                  {boardColumns.map((c) => {
                    const col = c.id;
                    const dragFrom = activeTask ? columnOf(activeTask.id) : null;
                    const draggedOver = activeTask !== null && overColumn === col && dragFrom !== col;
                    const blocked = draggedOver && dragFrom !== null && !canMove(dragFrom, col, workflow);
                    return (
                      <BoardColumn
                        key={col}
                        column={c}
                        count={counts[col] ?? 0}
                        countRef={col === DONE_COLUMN ? completedCountRef : undefined}
                        highlight={(draggedOver && !blocked) || flash === col}
                        blocked={blocked}
                        empty={columns[col].length === 0}
                        dragging={activeTask !== null}
                        // New tasks can start in any column a task may move to from Todo, except Completed.
                        canAdd={startColumns.some((x) => x.id === col)}
                        defaultTag={activeTag ?? undefined}
                        onDeleteAll={columns[col].length > 0 ? () => askDeleteAll(col, columns[col]) : undefined}
                      >
                        <SortableContext items={columns[col].map((t) => t.id)} strategy={verticalListSortingStrategy}>
                          {columns[col].map((t) => (
                            <SortableTaskRow
                              key={t.id}
                              task={t}
                              tag={findTag(tags, t.tag)}
                              leaving={removingId === t.id}
                              moving={moving.has(t.id)}
                              landed={landed === t.id}
                              onToggle={(origin) => toggleTask(t, origin)}
                              sortable={sortable && !moving.has(t.id)}
                              onOpen={() => openDetails(t.id)}
                              onDelete={() => askDelete({ kind: "task", id: t.id, title: t.title })}
                            />
                          ))}
                        </SortableContext>
                      </BoardColumn>
                    );
                  })}
                </div>

                {/* The card that follows the pointer while dragging (the original stays behind as a placeholder). */}
                <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
                  {activeTask ? (
                    <TaskCard
                      task={activeTask}
                      tag={findTag(tags, activeTask.tag)}
                      leaving={false}
                      moving={false}
                      landed={false}
                      onToggle={() => {}}
                      sortable
                      onOpen={() => {}}
                      onDelete={() => {}}
                      overlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>
          </section>
        </main>
      </div>

      <TagEditor
        open={tagEditorOpen}
        onOpenChange={setTagEditorOpen}
        tag={editingTag}
        onDeleted={(id) => tag === id && setTag(null)}
      />

      <TaskDetails
        task={selected}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onRequestDelete={(t) => askDelete({ kind: "task", id: t.id, title: t.title })}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} defaultTag={activeTag ?? undefined} />
      <TrashPanel
        open={trashOpen}
        onOpenChange={setTrashOpen}
        tasks={trashed}
        onDeleteForever={(t) => askDelete({ kind: "forever", id: t.id, title: t.title })}
        onEmptyTrash={() => askDelete({ kind: "empty", count: trashed.length })}
      />

      <Tour />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmDelete}
        {...confirmCopy(pending)}
      />
    </>
  );
}

/* ───────────────────────── Summary card ───────────────────────── */

function Summary({ total, doneCount }: { total: number; doneCount: number }) {
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const left = total - doneCount;
  const allDone = total > 0 && left === 0;
  const R = 40;
  const C = 2 * Math.PI * R;

  // Only rendered in the browser (a skeleton stands in before that), so local time is safe here.
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const h = now.getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  const message =
    total === 0
      ? "Nothing here yet. Click Task to add your first one."
      : allDone
        ? "Every task is ticked. Your board is all clear!"
        : `${left} ${left === 1 ? "task" : "tasks"} left — you've got this.`;

  return (
    <section className="gb-rise relative overflow-hidden rounded-[28px] bg-deep p-5 text-white shadow-[0_30px_80px_-30px_rgb(46_51_73/0.7)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="gb-blob absolute -right-16 -top-24 size-72 rounded-full bg-iris/40 blur-3xl" />
      </div>
      <div className="relative flex items-center justify-between gap-4 sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-peach/80 sm:text-xs">
            {dateLabel}
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
            {greeting} <span className="inline-block origin-[70%_70%] gb-wiggle">👋</span>
          </h1>
          <p className="mt-2 flex items-center gap-2 text-white/75">
            {allDone && <PartyPopper className="size-4 shrink-0 text-peach" />}
            {message}
          </p>
        </div>

        <div className="relative grid size-20 shrink-0 place-items-center sm:size-28">
          {allDone && <ConfettiBurst key={`done-${total}`} />}
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(255 255 255/0.12)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="#ffc9a9"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - (C * pct) / 100}
              style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.2,0.7,0.2,1)" }}
            />
          </svg>
          <div className="text-center">
            <p className="font-display text-xl font-extrabold tabular-nums sm:text-2xl">{pct}%</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">done</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Board column ───────────────────────── */

/** The column header's "⋯" button and its menu. */
function ColumnActions({ label, onCollapse }: { label: string; onCollapse: () => void }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger
        aria-label={`${label} column options`}
        title="Column options"
        className="grid size-7 place-items-center rounded-lg text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink data-popup-open:bg-ink/5 data-popup-open:text-ink"
      >
        <Ellipsis className="size-4" />
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        {/* Below the task drawer (z-50) but above the board and its sticky bits. */}
        <BaseMenu.Positioner sideOffset={6} align="end" className="z-40">
          <BaseMenu.Popup className="w-52 origin-(--transform-origin) rounded-2xl border border-ink/10 bg-surface p-1.5 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <BaseMenu.Item
              onClick={onCollapse}
              className="flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-ink/80 outline-none transition-colors data-highlighted:bg-mist data-highlighted:text-ink"
            >
              <ChevronsRightLeft className="size-4 text-ink/50" />
              Collapse column
            </BaseMenu.Item>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

function BoardColumn({
  column,
  count,
  countRef,
  highlight,
  blocked = false,
  empty,
  dragging,
  canAdd,
  defaultTag,
  onDeleteAll,
  children,
}: {
  column: ColumnDef;
  count: number;
  /** The count (Completed's is where the ✓ bubble lands). */
  countRef?: RefObject<HTMLSpanElement | null>;
  /** A task is being dragged over from another column, or the sidebar pointed here. */
  highlight: boolean;
  /** A task is dragged over, but the workflow doesn't allow the move. */
  blocked?: boolean;
  empty: boolean;
  dragging: boolean;
  /** New tasks can start in this column (not Completed, nor one the workflow keeps them out of). */
  canAdd: boolean;
  /** The board's tag filter, given to new tasks so they stay in view. */
  defaultTag?: TagId;
  /** Move every task shown in this column to Trash (unset when it's empty). */
  onDeleteAll?: () => void;
  children: ReactNode;
}) {
  const id = column.id;
  const { setNodeRef } = useDroppable({ id: dropId(id) });
  const style = columnStyle(column);
  // Where the "Add task" card is open: the top (header's +), the bottom (under the tasks), or nowhere.
  const [adding, setAdding] = useState<"top" | "bottom" | null>(null);
  const addCard = (at: "top" | "bottom") =>
    canAdd && adding === at ? (
      <InlineAddTask status={id} label={label} at={at} defaultTag={defaultTag} onClose={() => setAdding(null)} />
    ) : null;
  const label = column.label;
  const collapsed = useCollapsedColumns().includes(id);

  // Collapsed: a slim strip with the name running down it. Click to open it again; tasks can still be dropped on it.
  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        role="group"
        aria-label={`${label}, ${count} ${count === 1 ? "task" : "tasks"}, collapsed`}
        data-column={id}
        className={`flex w-11 shrink-0 snap-start flex-col items-center rounded-2xl outline-2 outline-offset-2 transition-[outline-color] duration-200 ${style.wash} ${
          blocked ? "outline-dashed outline-coral/60" : highlight ? `outline-dashed ${style.ring}` : "outline-transparent"
        }`}
      >
        <button
          type="button"
          onClick={() => setColumnCollapsed(id, false)}
          aria-label={`Expand ${label}`}
          title="Expand column"
          className="flex w-full flex-col items-center gap-2 rounded-2xl px-1 py-2.5 transition-colors hover:bg-ink/5"
        >
          <ChevronsLeftRight className="size-4 text-ink/45" />
          <span ref={countRef} className="text-xs font-semibold tabular-nums text-ink/50">
            {count}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[11px] font-bold uppercase tracking-wider [writing-mode:vertical-rl] ${style.pill}`}
          >
            <span className="rotate-90">
              <ColumnIcon c={column} />
            </span>
            <span className="max-h-56 truncate">{label}</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`${label}, ${count} ${count === 1 ? "task" : "tasks"}`}
      data-tour={id === TODO_COLUMN ? "tasks" : undefined}
      data-column={id}
      // A fixed width, so more columns scroll sideways rather than squeezing. The outline marks a drop target.
      className={`flex w-[min(18rem,calc(100vw-4rem))] shrink-0 snap-start flex-col rounded-2xl p-2 outline-2 outline-offset-2 transition-[outline-color] duration-200 ${style.wash} ${
        blocked ? "outline-dashed outline-coral/60" : highlight ? `outline-dashed ${style.ring}` : "outline-transparent"
      }`}
    >
      {/* Header: a solid status pill and the count, with the column's actions on the right. */}
      <div className="flex items-center gap-2 py-0.5 pl-0.5 pr-0">
        <h2
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${style.pill}`}
        >
          <ColumnIcon c={column} />
          <span className="truncate">{label}</span>
        </h2>
        <span ref={countRef} className="inline-block text-xs font-semibold tabular-nums text-ink/50">
          {count}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          {onDeleteAll && (
            <button
              type="button"
              onClick={onDeleteAll}
              aria-label={`Delete all ${label.toLowerCase()} tasks`}
              title="Delete all"
              className="grid size-7 place-items-center rounded-lg text-ink/35 transition-colors hover:bg-coral/10 hover:text-coral"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          {canAdd && (
            <button
              type="button"
              onClick={() => setAdding("top")}
              aria-label={`Add a task to ${label}`}
              title="Add task"
              className="grid size-7 place-items-center rounded-lg text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Plus className="size-4" />
            </button>
          )}
          <ColumnActions label={label} onCollapse={() => setColumnCollapsed(id, true)} />
        </div>
      </div>

      {/* Each column scrolls on its own once its tasks outgrow the screen, so the headers stay put. */}
      <div className="gb-column-scroll -mx-1 mt-2 max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain px-1 py-0.5">
        <ul className={`flex flex-col gap-2 ${dragging ? "min-h-24" : ""}`}>
          {/* The card opens where the task will land: above the tasks, or below them. */}
          {adding === "top" && <li>{addCard("top")}</li>}
          {children}
          {adding === "bottom" && <li>{addCard("bottom")}</li>}
          {empty &&
            (dragging ? (
              <li
                className={`flex min-h-20 items-center justify-center rounded-xl border-2 border-dashed px-4 text-center text-xs font-semibold transition-colors ${
                  blocked ? "border-coral/40 text-coral" : highlight ? "border-ink/25 text-ink/60" : "border-ink/10 text-ink/40"
                }`}
              >
                {blocked ? "Not allowed by your workflow" : "Drop it here"}
              </li>
            ) : (
              !adding && <li className="px-2 py-2 text-xs text-ink/40">No tasks</li>
            ))}
        </ul>
      </div>

      {canAdd && adding !== "bottom" && (
        <button
          type="button"
          onClick={() => setAdding("bottom")}
          data-tour={id === TODO_COLUMN ? "add-task" : undefined}
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <Plus className="size-3.5" />
          Add task
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── Task card ───────────────────────── */

type TaskRowProps = {
  task: Task;
  /** The task's tag, already resolved (unknown tags show as Default). */
  tag: TagView;
  leaving: boolean;
  /** Just ticked: pausing in place before moving to its next column. */
  moving: boolean;
  /** Just arrived in the Completed column: briefly highlighted. */
  landed: boolean;
  /** Called with the checkbox's position, so a bubble can fly from it. */
  onToggle: (origin: DOMRect) => void;
  /** False in Today/Upcoming, which are sorted by start time. */
  sortable: boolean;
  onOpen: () => void;
  onDelete: () => void;
};

/** The grip button's drag wiring (keyboard drags start from it). */
type Grip = {
  ref: (el: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
};

/** A draggable task. A copy follows the pointer and this one stays behind as a placeholder. */
function SortableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id, disabled: !props.sortable });
  // Pointer/touch drags start anywhere on the card; keyboard drags start from the grip.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      {...pointerListeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Raised while just ticked (confetti), so it draws over the cards around it.
      className={`relative touch-manipulation ${props.moving ? "z-10" : ""}`}
    >
      <TaskCard
        {...props}
        placeholder={isDragging}
        grip={
          props.sortable
            ? {
                ref: setActivatorNodeRef,
                attributes,
                onKeyDown: onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined,
              }
            : undefined
        }
      />
    </li>
  );
}

function TaskCard({
  task,
  tag,
  leaving,
  moving,
  landed,
  onToggle,
  sortable,
  onOpen,
  onDelete,
  grip,
  placeholder = false,
  overlay = false,
}: TaskRowProps & {
  grip?: Grip;
  /** Left behind in the column while its copy is being dragged. */
  placeholder?: boolean;
  /** The copy that follows the pointer while dragging. */
  overlay?: boolean;
}) {
  const [burst, setBurst] = useState(0);
  // The subtask list under the card: closed, open, or open with the new-subtask row ready.
  const [subtasks, setSubtasks] = useState<"closed" | "open" | "adding">("closed");
  const showSubtasks = subtasks !== "closed" && !overlay && !placeholder;
  // Bumped by each "Add subtask" press, so the list reopens its new-subtask row every time.
  const [addPress, setAddPress] = useState(0);
  // Done, or in the column ticking sends tasks to (e.g. "In review"): shown ticked either way.
  const ticked = isTicked(task, useTickColumn());
  const schedule = task.start && task.end ? { start: task.start, end: task.end } : null;
  const status = schedule ? scheduleStatus(schedule, task.done) : null;
  const preview = task.descriptionText?.replace(/\s+/g, " ").trim();

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    if (!ticked) setBurst((b) => b + 1);
    onToggle(e.currentTarget.getBoundingClientRect());
  }

  return (
    // The card carries the entrance animation, which would override the li's drag transform.
    <div
      className={`group relative rounded-xl border bg-white p-3 dark:bg-surface transition-[box-shadow,transform,opacity,border-color] duration-200 ${
        overlay ? "" : "gb-rise"
      } ${ticked ? "border-success/25" : "border-ink/10"} ${leaving ? "scale-95 opacity-0" : ""} ${
        overlay
          ? "rotate-[2deg] cursor-grabbing shadow-[0_24px_50px_-15px_rgb(20_22_34/0.55)] ring-2 ring-iris/40"
          : placeholder
            ? "border-dashed border-ink/20 opacity-40 shadow-none"
            : `shadow-[0_1px_2px_rgb(20_22_34/0.06)] hover:border-ink/20 hover:shadow-md ${sortable ? "cursor-grab" : ""}`
      }`}
      style={{ animationDuration: "0.4s" } as CSSProperties}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={ticked ? `Untick "${task.title}"` : `Tick "${task.title}"`}
          aria-pressed={ticked}
          className="relative mt-px shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
        >
          <CheckBox done={ticked} size={20} />
          {burst > 0 && ticked && <ConfettiBurst key={burst} />}
        </button>

        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open details for "${task.title}"`}
          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
        >
          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug">
            <span className={`gb-strike ${ticked ? "text-ink/55" : ""}`} data-done={ticked || undefined}>
              {task.title}
            </span>
          </p>
          {preview && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/50">
              <NotebookPen className="size-3 shrink-0 text-iris" aria-hidden />
              <span className="truncate">{preview}</span>
            </p>
          )}
        </button>

        {/* Shown on hover (always on touch screens, and when focused by keyboard). */}
        <div className="-mr-1.5 -mt-1 flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            onClick={() => {
              setSubtasks("adding");
              setAddPress((n) => n + 1);
            }}
            aria-label={`Add a subtask to "${task.title}"`}
            title="Add subtask"
            className="grid size-7 place-items-center rounded-lg text-ink/35 transition-colors hover:bg-ink/5 hover:text-ink/70 focus-visible:outline-2 focus-visible:outline-iris"
          >
            <ListTree className="size-3.5" />
          </button>
          {sortable && (
            <button
              type="button"
              ref={grip?.ref}
              {...grip?.attributes}
              onKeyDown={grip?.onKeyDown}
              aria-label={`Move "${task.title}"`}
              className="grid size-7 cursor-grab place-items-center rounded-lg text-ink/35 transition-colors hover:bg-ink/5 hover:text-ink/70 focus-visible:outline-2 focus-visible:outline-iris"
            >
              <GripVertical className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete "${task.title}"`}
            className="grid size-7 place-items-center rounded-lg text-ink/35 transition-colors hover:bg-coral/10 hover:text-coral focus-visible:text-coral"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Details under the title, lined up with it. The assignee sits at the far right. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[30px]">
        <TagChip tag={tag} />
        <PriorityChip priority={task.priority} />
        <SubtaskToggle
          task={task}
          open={showSubtasks}
          onToggle={() => setSubtasks(showSubtasks ? "closed" : "open")}
        />
        {moving && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-white">
            <ArrowRight className="gb-nudge-right size-3" aria-hidden />
            Moving
          </span>
        )}
        {schedule && status && (
          <>
            {status.label && (
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>
                {status.label}
              </span>
            )}
            <span
              className={`inline-flex items-start gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold leading-snug ${
                status.label ? "bg-ink/5 text-ink/70" : status.cls
              }`}
            >
              <CalendarClock className="mt-px size-3 shrink-0" aria-hidden />
              {formatSchedule(schedule)}
            </span>
          </>
        )}
        <span className="ml-auto">
          <AssigneeBadge assignee={task.assignee} />
        </span>
      </div>

      {showSubtasks && (
        <CardSubtasks
          key={subtasks === "adding" ? `add-${addPress}` : "open"}
          task={task}
          startAdding={subtasks === "adding"}
          onOpenTask={onOpen}
          onClose={() => setSubtasks("closed")}
        />
      )}

      {landed && <span aria-hidden className="gb-landed pointer-events-none absolute inset-0 rounded-[inherit]" />}
      {moving && (
        <span
          aria-hidden
          className="gb-move-progress absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-success"
          style={{ animationDuration: `${MOVE_PROGRESS_MS}ms` }}
        />
      )}
    </div>
  );
}


/* ───────────────────────── Empty states ───────────────────────── */

function FilterChip({ label, tag, onClear }: { label: string; tag?: TagView; onClear: () => void }) {
  return (
    <span className="gb-pop inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-surface py-1 pl-3 pr-1 text-xs font-semibold">
      {tag && <TagDot tag={tag} />}
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label} filter`}
        className="grid size-5 place-items-center rounded-full text-ink/50 transition-colors hover:bg-mist hover:text-ink"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function EmptyState({
  filter,
  filterLabel,
  total,
  view,
  narrowed,
  onClear,
}: {
  /** The status picked (null for All). */
  filter: Filter | null;
  filterLabel: string;
  total: number;
  view: View;
  narrowed: boolean;
  onClear: () => void;
}) {
  const content =
    total > 0 && narrowed
      ? view === "today"
        ? { emoji: "☀️", title: "Nothing scheduled for today", body: "Give a task a timeline that covers today to see it here." }
        : view === "upcoming"
          ? { emoji: "🗓️", title: "Nothing upcoming", body: "Tasks with a timeline starting tomorrow or later show up here." }
          : { emoji: "🔍", title: "No matching tasks", body: "Try a different search or tag." }
      : total > 0 && filter === "todo"
        ? { emoji: "🎉", title: "Nothing waiting", body: "Every task is started or ticked off. New tasks start here." }
        : total > 0 && filter !== null && filter !== "done"
          ? { emoji: "⏳", title: `Nothing in ${filterLabel}`, body: `Open a task and set its status to ${filterLabel} to put it here.` }
          : total > 0 && filter === "done"
            ? { emoji: "✅", title: "Nothing ticked yet", body: "Go on, tick your first task off." }
            : { emoji: "🌱", title: "Your board is empty", body: "Click Task above, or Add task in a column, to plant your first one." };

  return (
    <div className="gb-pop flex flex-col items-center rounded-[28px] border-2 border-dashed border-ink/10 px-6 py-14 text-center">
      <span className="gb-float grid size-16 place-items-center rounded-2xl bg-surface text-3xl shadow-md">
        {content.emoji}
      </span>
      <h2 className="mt-5 font-display text-xl font-bold">{content.title}</h2>
      <p className="mt-1 max-w-xs text-ink/60">{content.body}</p>
      {narrowed && total > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-xl border border-ink/15 bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-mist"
        >
          Show all tasks
        </button>
      )}
      {total === 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink/40">
          <ClipboardCheck className="size-3.5" />
          Tasks are saved in this browser
        </p>
      )}
    </div>
  );
}
