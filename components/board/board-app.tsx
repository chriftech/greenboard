"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type KeyboardEventHandler,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowRight,
  Menu,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  GripVertical,
  X,
  NotebookPen,
  PartyPopper,
  Plus,
  Trash2,
} from "lucide-react";
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
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Logo } from "@/components/landing/logo";
import { CheckBox, ConfettiBurst } from "@/components/landing/check-box";
import { TaskDetails } from "./task-details";
import { ConfirmDialog } from "./confirm-dialog";
import { TagEditor } from "./tag-editor";
import { TagChip, TagDot, TagRadio } from "./tag-chip";
import { AssigneeBadge, AssigneePicker, PriorityChip, PriorityPicker } from "./task-meta";
import { findTag, tagActions, useTags, type CustomTag, type TagView } from "@/lib/tags";
import { TrashPanel } from "./trash-panel";
import { Tour } from "./tour";
import { hasSeenTour, tourActions } from "@/lib/tour";
import { useSettings } from "@/lib/settings";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileMenu } from "./profile-menu";
import { BoardToolbar } from "./board-toolbar";
import { ImportDialog } from "./import-dialog";
import { usePeople } from "@/lib/people";
import { registerBoard, useColumns, useWorkspace, workspace, type Filter, type NavTarget, type View } from "@/lib/workspace";
import { GreetingSkeleton, TaskBoardSkeleton } from "./board-skeleton";
import {
  ScheduleFields,
  draftsToSchedule,
  formatSchedule,
  isScheduledToday,
  isUpcoming,
  scheduleStatus,
  type DateTimeDraft,
} from "./schedule";
import {
  DEFAULT_TAG,
  STATUSES,
  TRASH_DAYS,
  getServerTasks,
  getTasks,
  statusOf,
  subscribeTasks,
  taskActions,
  type PriorityId,
  type TagId,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";

/** The board's two columns (wider screens). */
/** The board's columns (and phone tabs): one per status. */
type ColumnId = TaskStatus;
const COLUMN_IDS: readonly ColumnId[] = ["todo", "pending", "done"];
/** Which column or tab a "Delete all" empties. */
type DeleteAllList = ColumnId;
/** Destructive actions waiting for confirmation. */
type PendingDelete =
  | { kind: "task"; id: string; title: string } // move one task to Trash
  | { kind: "all"; ids: string[]; list: DeleteAllList; narrowed: boolean } // move every task shown in a column or tab to Trash
  | { kind: "forever"; id: string; title: string } // delete one trashed task for good
  | { kind: "empty"; count: number } // delete everything in Trash for good
  | { kind: "tag"; id: string; label: string; count: number }; // delete a custom tag

function confirmCopy(p: PendingDelete | null) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  switch (p?.kind) {
    case "all": {
      const n = p.ids.length;
      const kind = p.list === "todo" ? "todo task" : p.list === "pending" ? "pending task" : "completed task";
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

/** Phone tabs: tasks grouped by status. */
const FILTERS: { id: Filter; label: string }[] = STATUSES.map((s) => ({ id: s.id, label: s.label }));

/** Droppable ids for the columns themselves (tasks use their own ids). */
const COLUMN_DROP: Record<ColumnId, string> = { todo: "col-todo", pending: "col-pending", done: "col-done" };

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

export function BoardApp() {
  const { showGreeting } = useSettings();
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  // View, tag, search and filters live in the workspace store, shared with the sidebar
  // (which stays on screen across /board, /settings and /help).
  const { view, filter, tag, query, priority, assignee: assigneeFilter } = useWorkspace();
  const { setView, setFilter, setTag, setQuery, setPriority, setAssignee: setAssigneeFilter } = workspace;
  const columnsLayout = useColumns();
  const people = usePeople();
  const [importOpen, setImportOpen] = useState(false);
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

  // The Completed column's count (or tab's, on phones): where the "done" bubble flies to.
  const completedCountRef = useRef<HTMLSpanElement>(null);
  // The Completed column itself, so the sidebar's "Completed" can bring it into view.
  const doneColumnRef = useRef<HTMLDivElement>(null);
  // A column briefly highlighted after the sidebar points at it.
  const [flash, setFlash] = useState<ColumnId | null>(null);
  // While dragging: which task, and which column it's over.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);

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

  function toggleTask(task: Task, origin?: DOMRect) {
    const nowDone = !task.done;
    taskActions.toggle(task.id);
    if (nowDone && origin) flyToCompleted(origin);
    if (!nowDone) return stopMoving(task.id); // unticked during the pause: stay put
    if (!columnsLayout && filter === "done") return; // already looking at Completed: nothing moves
    const from = statusOf(task);
    setMoving((s) => new Map(s).set(task.id, from));
    moveTimers.current.set(
      task.id,
      window.setTimeout(() => {
        stopMoving(task.id);
        setLanded(task.id);
        setAnnouncement(`"${task.title}" moved to Completed.`);
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
    askDelete({ kind: "all", ids: tasks.map((t) => t.id), list, narrowed });

  // Tasks that are mid-move stay in their column (Todo or Pending) until their pause ends.
  const shownIn = (t: Task) => moving.get(t.id) ?? statusOf(t);
  const todo = scoped.filter((t) => shownIn(t) === "todo");
  const pendingTasks = scoped.filter((t) => shownIn(t) === "pending");
  const done = scoped.filter((t) => shownIn(t) === "done");
  // Counts change as soon as a task is ticked, before it slides across.
  const counts: Record<ColumnId, number> = { todo: 0, pending: 0, done: 0 };
  scoped.forEach((t) => counts[statusOf(t)]++);

  // My board: each column in the order the user dragged it into.
  // Today/Upcoming: soonest start first, and not draggable.
  const byOrder = (a: Task, b: Task) => a.order - b.order;
  const byStart = (a: Task, b: Task) => (a.start ?? "").localeCompare(b.start ?? "") || byOrder(a, b);
  const sortable = view === "board";
  todo.sort(sortable ? byOrder : byStart);
  pendingTasks.sort(sortable ? byOrder : byStart);
  done.sort(sortable ? byOrder : byStart);

  function navigate(target: NavTarget) {
    switch (target) {
      case "trash":
        return openTrash();
      case "completed": {
        setView("board");
        if (!columnsLayout) return setFilter("done");
        // Bring the Completed column into view and highlight it.
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        requestAnimationFrame(() =>
          doneColumnRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest", inline: "center" }),
        );
        setFlash("done");
        window.setTimeout(() => setFlash((f) => (f === "done" ? null : f)), 1400);
        return;
      }
      case "board":
        // "My board" is the reset: unfiltered, back on the Pending tab.
        clearFilters();
        setQuery("");
        setFilter("todo");
        return setView("board");
      default:
        setFilter("todo");
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
  } | null>(null);
  actions.current = {
    navigate,
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

  const columns: Record<ColumnId, Task[]> = { todo, pending: pendingTasks, done };
  const columnOf = (id: UniqueIdentifier): ColumnId | null => {
    const key = String(id);
    return COLUMN_IDS.find((c) => key === COLUMN_DROP[c] || columns[c].some((t) => t.id === key)) ?? null;
  };
  const activeTask = activeId ? all.find((t) => t.id === activeId) ?? null : null;

  // Phones: one list per status, picked with the Todo / Pending / Completed tabs.
  const list = columns[filter];
  const listCount = list.length;

  /** Phones: reorder within one status; never across them. */
  function handleListDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const group = COLUMN_IDS.map((c) => columns[c]).find((g) => g.some((t) => t.id === active.id));
    if (!group || !group.some((t) => t.id === over.id)) return;
    const ids = group.map((t) => t.id);
    taskActions.reorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

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
    const overTask = String(over.id) !== COLUMN_DROP[to] ? String(over.id) : null;

    if (from === to) {
      // Reorder within the column; dropping on the column's empty space moves it to the end.
      const ids = columns[from].map((t) => t.id);
      const target = overTask ? ids.indexOf(overTask) : ids.length - 1;
      if (target === -1 || target === ids.indexOf(id)) return;
      taskActions.reorder(arrayMove(ids, ids.indexOf(id), target));
      return;
    }

    // Across columns: give it that column's status, placed where it was dropped.
    const ids = columns[to].map((t) => t.id);
    const at = overTask ? ids.indexOf(overTask) : -1;
    ids.splice(at === -1 ? ids.length : at, 0, id);
    taskActions.setStatus(id, to);
    taskActions.reorder(ids);
    const title = all.find((t) => t.id === id)?.title ?? "Task";
    setAnnouncement(`"${title}" moved to ${COLUMN_META[to].title}.`);
    if (to === "done") {
      setLanded(id);
      window.setTimeout(() => setLanded((l) => (l === id ? null : l)), 1100);
    }
  }

  return (
    <>
      {/* `isolate` lets the grid below sit behind the content (-z-10) without dropping under the page background. */}
      <div className="relative isolate min-w-0 flex-1 overflow-x-clip">
        {/*
          Full-screen backdrop, fixed so it stays put while the board scrolls.
          It sits behind the sidebar (z-30) and the content (positioned later).
        */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
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
  
        <header className="relative mx-auto flex max-w-5xl items-center justify-between px-4 pt-6 lg:justify-end">
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
  
        <main className="relative pb-24 pt-8">
          <div className="relative">
            {/*
              The grid scrolls with the page: full strength behind the header, fading out by the
              time the task columns start (it reaches up past the header and down to the board).
            */}
            <div aria-hidden className="gb-grid-bg gb-grid-fade pointer-events-none absolute inset-x-0 -top-40 -bottom-10 -z-10" />
            <div className="mx-auto max-w-5xl px-4">
              {/* The greeting card can be turned off in Settings (which, like the tasks, is only known once loaded). */}
              {!loaded ? (
                <GreetingSkeleton />
              ) : (
                showGreeting && <Summary total={all.length} doneCount={all.length - pendingAll.length} />
              )}
              <Composer />

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

              {/* Phones: tabs instead of columns. */}
              {!columnsLayout && (
                <div className={`${sidebarNarrowed ? "mt-4" : "mt-10"} flex flex-wrap items-center justify-between gap-3`}>
                  <div
                    role="tablist"
                    aria-label="Filter tasks"
                    data-tour="filters"
                    className="relative grid w-full grid-cols-3 rounded-2xl border border-ink/10 bg-surface p-1 sm:w-auto"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-deep transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                      style={{ transform: `translateX(${FILTERS.findIndex((f) => f.id === filter) * 100}%)` }}
                    />
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.id}
                        onClick={() => setFilter(f.id)}
                        className={`relative z-10 flex items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 py-2 text-[13px] font-semibold transition-colors sm:gap-1.5 sm:px-4 sm:text-sm ${
                          filter === f.id ? "text-peach" : "text-ink/60 hover:text-ink"
                        }`}
                      >
                        {f.label}
                        <span
                          ref={f.id === "done" ? completedCountRef : undefined}
                          className={`inline-block rounded-full px-1.5 text-[11px] tabular-nums ${
                            filter === f.id ? "bg-white/15" : "bg-ink/5"
                          }`}
                        >
                          {loaded ? counts[f.id] : "–"}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Empties the tab you're on: Todo, Pending or Completed (only the tasks shown). */}
                  {listCount > 0 && (
                    <button
                      type="button"
                      onClick={() => askDeleteAll(filter, list)}
                      className="text-sm font-medium text-ink/55 underline-offset-4 transition-colors hover:text-coral hover:underline"
                    >
                      Delete all ({listCount})
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* The board: Pending and Completed columns side by side, as wide as the section above. Phones get the tabbed list. */}
          <section
            aria-label="Task board"
            className={`mx-auto max-w-5xl px-4 ${columnsLayout ? (sidebarNarrowed ? "mt-5" : "mt-10") : "mt-5"}`}
          >
            {/* Filters on the left, Export on the far right, above the columns. */}
            {loaded && (
              <BoardToolbar
                empty={all.length === 0}
                onImport={() => setImportOpen(true)}
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
            )}
            {!loaded ? (
              <TaskBoardSkeleton />
            ) : (columnsLayout ? scoped.length : listCount) === 0 ? (
              <div>
                <EmptyState
                  filter={columnsLayout ? null : filter}
                  total={all.length}
                  view={view}
                  narrowed={narrowed}
                  onClear={clearNarrowing}
                />
              </div>
            ) : !columnsLayout ? (
              <DndContext
                // Separate keys: switching layouts (crossing 768px) must remount, not reuse, the drag context.
                key="task-list"
                id="task-list"
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleListDragEnd}
                accessibility={{
                  screenReaderInstructions: {
                    draggable:
                      "To reorder, press space or enter to pick up the task, use the up and down arrow keys to move it, then space or enter to drop it. Press escape to cancel.",
                  },
                  announcements: {
                    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
                    onDragOver: ({ active, over }) =>
                      over ? `${titleOf(active.id)} is over ${titleOf(over.id)}.` : `${titleOf(active.id)} is not over a task.`,
                    onDragEnd: ({ active, over }) =>
                      over ? `${titleOf(active.id)} moved to the position of ${titleOf(over.id)}.` : `${titleOf(active.id)} dropped.`,
                    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
                  },
                }}
              >
                <ul className="space-y-3" data-tour="tasks-list" aria-live="polite">
                  <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {list.map((t) => (
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
                        inPlace
                      />
                    ))}
                  </SortableContext>
                </ul>
              </DndContext>
            ) : (
              <DndContext
                key="task-board"
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
                      "To move a task, press space or enter to pick it up, use the arrow keys to move it within or between the Todo, Pending and Completed columns, then space or enter to drop it. Press escape to cancel.",
                  },
                  announcements: {
                    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
                    onDragOver: ({ active, over }) =>
                      over
                        ? String(over.id).startsWith("col-")
                          ? `${titleOf(active.id)} is over the ${COLUMN_META[columnOf(over.id) ?? "todo"].title} column.`
                          : `${titleOf(active.id)} is over ${titleOf(over.id)}.`
                        : `${titleOf(active.id)} is not over a column.`,
                    onDragEnd: ({ active, over }) =>
                      over ? `${titleOf(active.id)} dropped.` : `${titleOf(active.id)} was not moved.`,
                    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
                  },
                }}
              >
                <div
                  data-tour="columns"
                  // Three open columns under a horizontal line, split by vertical lines that meet it (no cards).
                  className="grid grid-cols-3 divide-x divide-ink/15 border-t border-ink/15"
                >
                  {COLUMN_IDS.map((col) => (
                    <BoardColumn
                      key={col}
                      id={col}
                      count={counts[col]}
                      countRef={col === "done" ? completedCountRef : undefined}
                      columnRef={col === "done" ? doneColumnRef : undefined}
                      highlight={(activeTask !== null && overColumn === col && columnOf(activeTask.id) !== col) || flash === col}
                      empty={columns[col].length === 0}
                      dragging={activeTask !== null}
                      action={
                        columns[col].length > 0 ? (
                          <button
                            type="button"
                            onClick={() => askDeleteAll(col, columns[col])}
                            aria-label={`Delete all ${COLUMN_META[col].title.toLowerCase()} tasks`}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-ink/50 transition-colors hover:bg-coral/10 hover:text-coral"
                          >
                            Delete all
                          </button>
                        ) : null
                      }
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
                  ))}
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
      ? "Nothing here yet. Add your first task below."
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

/* ───────────────────────── Composer ───────────────────────── */

function Composer() {
  const [title, setTitle] = useState("");
  const tags = useTags();
  const [pickedTag, setTag] = useState<TagId>(DEFAULT_TAG);
  // Fall back to Default if the picked custom tag was deleted.
  const tag = tags.some((t) => t.id === pickedTag) ? pickedTag : DEFAULT_TAG;
  const [scheduling, setScheduling] = useState(false);
  const [start, setStart] = useState<DateTimeDraft>({});
  const [end, setEnd] = useState<DateTimeDraft>({});
  const [priority, setPriority] = useState<PriorityId | undefined>();
  const [assignee, setAssignee] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const schedule = scheduling ? draftsToSchedule(start, end) : null;
  const canSubmit = !!title.trim() && schedule !== "invalid";

  function closeSchedule() {
    setScheduling(false);
    setStart({});
    setEnd({});
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    taskActions.add({ title, tag, schedule: schedule ?? undefined, priority, assignee });
    setTitle("");
    setPriority(undefined);
    setAssignee(undefined);
    closeSchedule();
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={submit}
      className="gb-rise mt-6 first:mt-0 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)] sm:p-5"
      style={{ animationDelay: "120ms" }}
    >
      {/* Tag first, so it's chosen before typing the task. */}
      <div className="border-b border-ink/5 pb-4">
        <div role="radiogroup" aria-label="Tag" data-tour="tags" className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagRadio key={t.id} tag={t} checked={tag === t.id} onSelect={() => setTag(t.id)} checkedClassName="scale-105" />
          ))}
        </div>
      </div>

      <label htmlFor="new-task" className="sr-only">
        New task
      </label>
      <div data-tour="new-task" className="mt-4 flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-peach text-on-accent">
          <Plus className="size-5" strokeWidth={3} />
        </span>
        <input
          ref={inputRef}
          id="new-task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          autoComplete="off"
          autoFocus
          maxLength={140}
          className="min-w-0 flex-1 bg-transparent font-display text-xl font-semibold placeholder:text-ink/30 focus:outline-none"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-4">
        <div data-tour="task-extras" className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (scheduling ? closeSchedule() : setScheduling(true))}
          aria-expanded={scheduling}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            scheduling
              ? "border-deep bg-deep text-peach"
              : "border-ink/10 text-ink/60 hover:border-ink/25 hover:text-ink"
          }`}
        >
          {scheduling ? <X className="size-3.5" /> : <CalendarClock className="size-3.5" />}
          {scheduling ? "Remove timeline" : "Add timeline"}
        </button>
          <PriorityPicker value={priority} onChange={setPriority} variant="pill" />
          <AssigneePicker value={assignee} onChange={setAssignee} variant="pill" />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="gb-shine inline-flex items-center gap-1.5 rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-peach transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
        >
          Add task
        </button>
      </div>

      {scheduling && (
        <div className="gb-rise mt-4 rounded-2xl bg-paper p-3 sm:p-4" style={{ animationDuration: "0.35s" }}>
          <ScheduleFields
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
          />
        </div>
      )}
    </form>
  );
}

/* ───────────────────────── Columns ───────────────────────── */

const COLUMN_META: Record<ColumnId, { title: string; dot: string; emptyTitle: string; emptyBody: string }> = {
  todo: {
    title: "Todo",
    dot: "bg-iris",
    emptyTitle: "Nothing waiting 🎉",
    emptyBody: "New tasks start here. Add one above.",
  },
  pending: {
    title: "Pending",
    dot: "bg-peach",
    emptyTitle: "Nothing in progress",
    emptyBody: "Drag a task here, or set its status to Pending, when you start on it.",
  },
  done: {
    title: "Completed",
    dot: "bg-success",
    emptyTitle: "Nothing ticked yet",
    emptyBody: "Tick a task's circle, or drag it here, to complete it.",
  },
};

function BoardColumn({
  id,
  count,
  countRef,
  columnRef,
  highlight,
  empty,
  dragging,
  action,
  children,
}: {
  id: ColumnId;
  count: number;
  /** The count badge (Completed's is where the ✓ bubble lands). */
  countRef?: RefObject<HTMLSpanElement | null>;
  columnRef?: RefObject<HTMLDivElement | null>;
  /** A task is being dragged over from the other column, or the sidebar pointed here. */
  highlight: boolean;
  empty: boolean;
  dragging: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: COLUMN_DROP[id] });
  const meta = COLUMN_META[id];

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        if (columnRef) columnRef.current = el;
      }}
      role="group"
      aria-label={`${meta.title}, ${count} ${count === 1 ? "task" : "tasks"}`}
      data-tour={id === "todo" ? "tasks" : undefined}
      // Open columns: spacing either side of the dividing line, none at the outer edges.
      className="flex min-w-0 flex-col px-5 pt-4 first:pl-0 last:pr-0"
    >
      <div className="flex items-center gap-2 px-1 pb-3 pt-1">
        <span aria-hidden className={`size-2.5 rounded-full ${meta.dot}`} />
        <h2 className={`font-display text-base font-bold transition-colors ${highlight ? "text-iris" : ""}`}>{meta.title}</h2>
        <span
          ref={countRef}
          className="inline-block rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink/60"
        >
          {count}
        </span>
        <span className="ml-auto">{action}</span>
      </div>
      {/* Each column scrolls on its own once its tasks outgrow the screen, so the headers stay put.
          The padding (taken back by the negative margin) leaves room for the drop outline. */}
      <div className="gb-column-scroll -m-2 flex max-h-[calc(100dvh-11rem)] flex-1 flex-col overflow-y-auto overscroll-contain p-2">
        {/* The drop zone: outlined (without shifting anything) while a task is dragged over from the other column. */}
        <ul
          className={`flex min-h-[132px] flex-1 flex-col gap-3 rounded-2xl outline-2 outline-offset-[6px] transition-[outline-color,background-color] duration-200 ${
            highlight ? "bg-iris/5 outline-dashed outline-iris/50" : "outline-transparent"
          }`}
        >
          {children}
          {empty && (
            <li
              className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                highlight ? "border-iris/50" : "border-ink/10"
              }`}
            >
              <p className="font-display font-bold">{dragging ? "Drop it here" : meta.emptyTitle}</p>
              {!dragging && <p className="mt-1 max-w-[16rem] text-sm text-ink/55">{meta.emptyBody}</p>}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────── Task row ───────────────────────── */

type TaskRowProps = {
  task: Task;
  /** The task's tag, already resolved (unknown tags show as Default). */
  tag: TagView;
  leaving: boolean;
  /** Just ticked: pausing in place before moving to the Completed column. */
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

/**
 * A draggable task. In the columns, a copy follows the pointer and this one stays behind as a placeholder;
 * in the phone list (`inPlace`), the card itself moves.
 */
function SortableTaskRow({ inPlace = false, ...props }: TaskRowProps & { inPlace?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id, disabled: !props.sortable });
  // Pointer/touch drags start anywhere on the card; keyboard drags start from the grip.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      {...pointerListeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Raised while just ticked (confetti) or dragged in place, so it draws over the rows around it.
      className={`relative touch-manipulation ${props.moving || (inPlace && isDragging) ? "z-10" : ""}`}
    >
      <TaskCard
        {...props}
        placeholder={!inPlace && isDragging}
        lifted={inPlace && isDragging}
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
  lifted = false,
}: TaskRowProps & {
  grip?: Grip;
  /** Being dragged in place (phone list). */
  lifted?: boolean;
  /** Left behind in the column while its copy is being dragged. */
  placeholder?: boolean;
  /** The copy that follows the pointer while dragging. */
  overlay?: boolean;
}) {
  const [burst, setBurst] = useState(0);
  const schedule = task.start && task.end ? { start: task.start, end: task.end } : null;
  const status = schedule ? scheduleStatus(schedule, task.done) : null;
  const preview = task.descriptionText?.replace(/\s+/g, " ").trim();

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    if (!task.done) setBurst((b) => b + 1);
    onToggle(e.currentTarget.getBoundingClientRect());
  }

  return (
    // The card carries the entrance animation, which would override the li's drag transform.
    <div
      className={`group relative flex items-center gap-2 rounded-2xl border py-3.5 pl-1.5 pr-3 transition-[box-shadow,transform,opacity,background-color,border-color] duration-300 ${
        overlay ? "" : "gb-rise"
      } ${task.done ? "border-success/25 bg-success-soft" : "border-ink/10 bg-surface hover:shadow-md"} ${
        leaving ? "scale-95 opacity-0" : ""
      } ${
        overlay
          ? "rotate-[1.5deg] scale-[1.03] cursor-grabbing shadow-[0_24px_50px_-15px_rgb(20_22_34/0.55)] ring-2 ring-iris/50"
          : placeholder
            ? "border-dashed border-iris/40 opacity-40 shadow-none"
            : lifted
              ? "cursor-grabbing shadow-xl ring-2 ring-iris/40"
            : sortable
              ? "cursor-grab"
              : ""
      }`}
      style={{ animationDuration: "0.5s" } as CSSProperties}
    >
        {sortable ? (
          <button
            type="button"
            ref={grip?.ref}
            {...grip?.attributes}
            onKeyDown={grip?.onKeyDown}
            aria-label={`Move "${task.title}"`}
            className={`grid h-9 w-5 shrink-0 cursor-grab place-items-center rounded-md text-ink/25 transition-colors hover:text-ink/60 focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-iris group-hover:text-ink/45 ${
              overlay ? "cursor-grabbing text-ink/60" : ""
            }`}
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span aria-hidden className="w-1" />
        )}
  
        <button
          type="button"
          onClick={toggle}
          aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          aria-pressed={task.done}
          className="relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
        >
          <CheckBox done={task.done} size={28} />
          {burst > 0 && task.done && <ConfettiBurst key={burst} />}
        </button>
  
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open details for "${task.title}"`}
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-iris"
        >
          <p className="truncate">
            <span className="gb-strike text-base font-medium" data-done={task.done || undefined}>
              {task.title}
            </span>
          </p>
          {preview && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/55">
              <NotebookPen className="size-3.5 shrink-0 text-iris" aria-hidden />
              <span className="truncate">{preview}</span>
            </p>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <TagChip tag={tag} />
            <PriorityChip priority={task.priority} />
            {moving && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-white">
                <ArrowRight className="gb-nudge-right size-3" aria-hidden />
                Moving to Completed
              </span>
            )}
            {schedule && status && (
              <>
                {/* Status and date are separate chips so they wrap cleanly on narrow screens. */}
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
            {!preview && (
              <span className="hidden text-[11px] font-medium text-ink/35 opacity-0 transition-opacity group-hover:opacity-100 sm:inline [@media(hover:none)]:hidden">
                + Add details
              </span>
            )}
            <AssigneeBadge assignee={task.assignee} />
          </span>
        </button>
  
        <ChevronRight
          aria-hidden
          className="hidden size-4 shrink-0 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-ink/50 sm:block"
        />
  
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete "${task.title}"`}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-ink/35 transition-all group-hover:text-ink/60 hover:bg-coral/10 hover:text-coral! focus-visible:text-coral"
        >
          <Trash2 className="size-4" />
        </button>
        {landed && <span aria-hidden className="gb-landed pointer-events-none absolute inset-0 rounded-[inherit]" />}
        {moving && (
          <span
            aria-hidden
            className="gb-move-progress absolute inset-x-4 bottom-0 h-0.5 origin-left rounded-full bg-success"
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
  total,
  view,
  narrowed,
  onClear,
}: {
  /** The phone tab (null in the columns, which show both). */
  filter: Filter | null;
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
        : total > 0 && filter === "pending"
          ? { emoji: "⏳", title: "Nothing in progress", body: "Open a task and set its status to Pending when you start on it." }
          : total > 0 && filter === "done"
            ? { emoji: "✅", title: "Nothing ticked yet", body: "Go on, tick your first task off." }
            : { emoji: "🌱", title: "Your board is empty", body: "Type a task above and hit Enter to plant your first one." };

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
