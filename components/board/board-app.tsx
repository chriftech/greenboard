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
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  Menu,
  CalendarClock,
  Check,
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
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { findTag, tagActions, useTags, type CustomTag, type TagView } from "@/lib/tags";
import { TrashPanel } from "./trash-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar, Sidebar, type NavTarget, type SidebarProps } from "./sidebar";
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
  TRASH_DAYS,
  getServerTasks,
  getTasks,
  subscribeTasks,
  taskActions,
  type TagId,
  type Task,
} from "@/lib/tasks";

type Filter = "all" | "todo" | "done";
/** Which slice of the board is shown, chosen from the sidebar. */
type View = "board" | "today" | "upcoming";
/** Destructive actions waiting for confirmation. */
type PendingDelete =
  | { kind: "task"; id: string; title: string } // move one task to Trash
  | { kind: "done"; count: number } // move all completed tasks to Trash
  | { kind: "forever"; id: string; title: string } // delete one trashed task for good
  | { kind: "empty"; count: number } // delete everything in Trash for good
  | { kind: "tag"; id: string; label: string; count: number }; // delete a custom tag

function confirmCopy(p: PendingDelete | null) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  switch (p?.kind) {
    case "done":
      return {
        title: `Move ${plural(p.count, "completed task")} to Trash?`,
        description: `You can restore ${p.count === 1 ? "it" : "them"} from Trash for ${TRASH_DAYS} days. After that ${p.count === 1 ? "it's" : "they're"} deleted for good.`,
        confirmLabel: "Move to Trash",
      };
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

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "Pending" },
  { id: "done", label: "Completed" },
];

export function BoardApp() {
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("board");
  const [tag, setTag] = useState<TagId | null>(null);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const tags = useTags();
  // Tag editor: null = creating a new tag. Kept after closing so the dialog can animate out.
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  // A filter on a tag that was since deleted shows nothing; treat it as no filter.
  const activeTag = tag && tags.some((t) => t.id === tag) ? tag : null;
  // Keep the selected id after closing so the panel can animate out with its content.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loaded = tasks !== null;
  const selected = tasks?.find((t) => t.id === selectedId) ?? null;

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
  const [moving, setMoving] = useState<ReadonlySet<string>>(() => new Set());
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
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  // The Completed tab's count: where the "done" bubble flies to.
  const completedCountRef = useRef<HTMLSpanElement>(null);

  /** A small ✓ bubble arcs from the ticked checkbox into the Completed tab, which bumps. */
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
    if (filter === "done") return; // already looking at Completed: nothing moves
    setMoving((s) => new Set(s).add(task.id));
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
      case "done":
        return taskActions.trashDone();
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
    (!q || t.title.toLowerCase().includes(q) || (t.descriptionText ?? "").toLowerCase().includes(q));
  const scoped = all.filter(matches);
  const narrowed = view !== "board" || activeTag !== null || q !== "";

  // Tasks that are mid-move stay in the pending group until their pause ends.
  const done = scoped.filter((t) => t.done && !moving.has(t.id));
  const todo = scoped.filter((t) => !t.done || moving.has(t.id));
  const doneCount = scoped.filter((t) => t.done).length;
  const counts: Record<Filter, number> = { all: scoped.length, todo: scoped.length - doneCount, done: doneCount };

  // My board: pending first, then completed, each in the order the user dragged
  // it into. Today/Upcoming: soonest start first, and not draggable.
  const byOrder = (a: Task, b: Task) => a.order - b.order;
  const byStart = (a: Task, b: Task) => (a.start ?? "").localeCompare(b.start ?? "") || byOrder(a, b);
  const sortable = view === "board";
  todo.sort(sortable ? byOrder : byStart);
  done.sort(sortable ? byOrder : byStart);

  function navigate(target: NavTarget) {
    switch (target) {
      case "trash":
        return openTrash();
      case "completed":
        setView("board");
        return setFilter("done");
      case "board":
        // "My board" is the reset: everything, unfiltered.
        setTag(null);
        setQuery("");
        setView("board");
        return setFilter("all");
      default:
        setView(target);
        return setFilter("all");
    }
  }

  function clearNarrowing() {
    setView("board");
    setTag(null);
    setQuery("");
  }

  // Sidebar state and counts (pending tasks, so the numbers mean "still to do").
  const pendingAll = all.filter((t) => !t.done);
  const sidebar: SidebarProps = {
    active: view !== "board" ? view : filter === "done" ? "completed" : "board",
    onNavigate: navigate,
    tag: activeTag,
    onTag: setTag,
    tags,
    onEditTag: (t) => {
      setEditingTag(t);
      setTagEditorOpen(true);
    },
    onDeleteTag: (t) =>
      askDelete({
        kind: "tag",
        id: t.id,
        label: t.label,
        // Every task (Trash included) carrying the tag moves to Default.
        count: (tasks ?? []).filter((x) => x.tag === t.id).length,
      }),
    query,
    onQuery: setQuery,
    counts: {
      board: pendingAll.length,
      today: pendingAll.filter((t) => inView(t, "today")).length,
      upcoming: pendingAll.filter((t) => inView(t, "upcoming")).length,
      completed: all.length - pendingAll.length,
      trash: trashed.length,
      tags: Object.fromEntries(
        tags.map((t) => [t.id, pendingAll.filter((x) => findTag(tags, x.tag).id === t.id).length]),
      ),
    },
  };

  const groups = filter === "all" ? [todo, done] : filter === "todo" ? [todo] : [done];
  const visibleCount = groups.reduce((n, g) => n + g.length, 0);

  // Drag starts after a small move (mouse) or a short press (touch), so clicks
  // and scrolling still work; the grip handle supports keyboard reordering.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const titleOf = (id: UniqueIdentifier) => `"${all.find((t) => t.id === id)?.title ?? "task"}"`;

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    // Reorder within pending or within completed; never across the two.
    const group = [todo, done].find((g) => g.some((t) => t.id === active.id));
    if (!group || !group.some((t) => t.id === over.id)) return;
    const ids = group.map((t) => t.id);
    taskActions.reorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <div className="flex min-h-full flex-1 bg-paper text-ink">
      <Sidebar {...sidebar} />
      <MobileSidebar {...sidebar} open={menuOpen} onOpenChange={setMenuOpen} />

      <div className="relative min-w-0 flex-1 overflow-x-clip">
        {/*
          Full-screen backdrop, fixed so it stays put while the board scrolls.
          It sits behind the sidebar (z-30) and the content (positioned later).
        */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="gb-grid-bg absolute inset-0" />
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
  
        <header className="relative mx-auto flex max-w-3xl items-center justify-between px-4 pt-6 md:justify-end">
          {/* The sidebar shows the logo from md up. */}
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <Logo />
            <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-surface hover:text-ink md:hidden"
            >
              <Menu className="size-4" />
              Menu
            </button>
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-surface hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </div>
        </header>
  
        <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-8">
          <Summary loaded={loaded} total={all.length} doneCount={all.length - pendingAll.length} />
          <Composer />
  
          {/* What the sidebar has narrowed the board to */}
          {narrowed && (
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

          {/* Filters */}
          <div className={`${narrowed ? "mt-4" : "mt-10"} flex flex-wrap items-center justify-between gap-3`}>
            <div
              role="tablist"
              aria-label="Filter tasks"
              className="relative grid grid-cols-3 rounded-2xl border border-ink/10 bg-surface p-1"
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
                  className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
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
  
            {done.length > 0 && (
              <button
                type="button"
                onClick={() => askDelete({ kind: "done", count: done.length })}
                className="text-sm font-medium text-ink/55 underline-offset-4 transition-colors hover:text-coral hover:underline"
              >
                Clear completed ({done.length})
              </button>
            )}
          </div>
  
          {/* List */}
          <section className="mt-5" aria-live="polite">
            {!loaded ? (
              <ul className="space-y-3" aria-label="Loading tasks">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-[68px] animate-pulse rounded-2xl bg-surface/70" />
                ))}
              </ul>
            ) : visibleCount === 0 ? (
              <EmptyState filter={filter} total={all.length} view={view} narrowed={narrowed} onClear={clearNarrowing} />
            ) : (
              <DndContext
                id="task-board"
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleDragEnd}
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
                <ul className="space-y-3">
                  {groups.map((group, i) => (
                    <SortableContext key={i} items={group.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {/* In "All", label where completed tasks go (also the target while one is moving). */}
                      {filter === "all" && group === done && (done.length > 0 || moving.size > 0) && (
                        <li aria-hidden className="flex items-center gap-3 pt-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-success">
                            <Check className="size-3.5" strokeWidth={3} />
                            Completed
                          </span>
                          <span className="h-px flex-1 bg-success/20" />
                          <span className="text-xs font-semibold tabular-nums text-ink/40">{doneCount}</span>
                        </li>
                      )}
                      {group.map((t) => (
                        <TaskRow
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
                  ))}
                </ul>
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

      <TrashPanel
        open={trashOpen}
        onOpenChange={setTrashOpen}
        tasks={trashed}
        onDeleteForever={(t) => askDelete({ kind: "forever", id: t.id, title: t.title })}
        onEmptyTrash={() => askDelete({ kind: "empty", count: trashed.length })}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmDelete}
        {...confirmCopy(pending)}
      />
    </div>
  );
}

/* ───────────────────────── Summary card ───────────────────────── */

function Summary({ loaded, total, doneCount }: { loaded: boolean; total: number; doneCount: number }) {
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const left = total - doneCount;
  const allDone = total > 0 && left === 0;
  const R = 40;
  const C = 2 * Math.PI * R;

  let dateLabel = "";
  let greeting = "Hello";
  if (loaded) {
    const now = new Date();
    dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const h = now.getHours();
    greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }

  const message = !loaded
    ? "Loading your board…"
    : total === 0
      ? "Nothing here yet. Add your first task below."
      : allDone
        ? "Every task is ticked. Your board is all clear!"
        : `${left} ${left === 1 ? "task" : "tasks"} left — you've got this.`;

  return (
    <section className="gb-rise relative overflow-hidden rounded-[28px] bg-deep p-6 text-white shadow-[0_30px_80px_-30px_rgb(46_51_73/0.7)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="gb-blob absolute -right-16 -top-24 size-72 rounded-full bg-iris/40 blur-3xl" />
      </div>
      <div className="relative flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-peach/80">
            {dateLabel || " "}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {greeting} <span className="inline-block origin-[70%_70%] gb-wiggle">👋</span>
          </h1>
          <p className="mt-2 flex items-center gap-2 text-white/75">
            {allDone && <PartyPopper className="size-4 shrink-0 text-peach" />}
            {message}
          </p>
        </div>

        <div className="relative grid size-24 shrink-0 place-items-center sm:size-28">
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
            <p className="font-display text-2xl font-extrabold tabular-nums">{pct}%</p>
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
    taskActions.add({ title, tag, schedule: schedule ?? undefined });
    setTitle("");
    closeSchedule();
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={submit}
      className="gb-rise mt-6 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)] sm:p-5"
      style={{ animationDelay: "120ms" }}
    >
      {/* Tag first, so it's chosen before typing the task. */}
      <div className="border-b border-ink/5 pb-4">
        <div role="radiogroup" aria-label="Tag" className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagRadio key={t.id} tag={t} checked={tag === t.id} onSelect={() => setTag(t.id)} checkedClassName="scale-105" />
          ))}
        </div>
      </div>

      <label htmlFor="new-task" className="sr-only">
        New task
      </label>
      <div className="mt-4 flex items-center gap-3">
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

/* ───────────────────────── Task row ───────────────────────── */

function TaskRow({
  task,
  tag,
  leaving,
  moving,
  landed,
  onToggle,
  sortable,
  onOpen,
  onDelete,
}: {
  task: Task;
  /** The task's tag, already resolved (unknown tags show as Default). */
  tag: TagView;
  leaving: boolean;
  /** Just ticked: pausing in place before moving to the Completed group. */
  moving: boolean;
  /** Just arrived in the Completed group: briefly highlighted. */
  landed: boolean;
  /** Called with the checkbox's position, so a bubble can fly from it. */
  onToggle: (origin: DOMRect) => void;
  /** False in Today/Upcoming, which are sorted by start time. */
  sortable: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [burst, setBurst] = useState(0);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !sortable });
  // Pointer/touch drags start anywhere on the card; keyboard drags start from the grip.
  const { onKeyDown: onGripKeyDown, ...pointerListeners } = listeners ?? {};
  const schedule = task.start && task.end ? { start: task.start, end: task.end } : null;
  const status = schedule ? scheduleStatus(schedule, task.done) : null;
  const preview = task.descriptionText?.replace(/\s+/g, " ").trim();

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    if (!task.done) setBurst((b) => b + 1);
    onToggle(e.currentTarget.getBoundingClientRect());
  }

  return (
    <li
      ref={setNodeRef}
      {...pointerListeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Raised while dragging, and while just ticked so its confetti draws over the rows around it.
      className={`relative touch-manipulation ${isDragging ? "z-20" : moving ? "z-10" : ""}`}
    >
      {/* Inner card carries the entrance animation, which would override the li's drag transform. */}
      <div
        className={`gb-rise group relative flex items-center gap-2 rounded-2xl border py-3.5 pl-1.5 pr-4 transition-[box-shadow,transform,opacity,background-color,border-color] duration-300 ${
          task.done ? "border-success/25 bg-success-soft" : "border-ink/10 bg-surface hover:shadow-md"
        } ${leaving ? "scale-95 opacity-0" : ""} ${
          isDragging
            ? "scale-[1.02] cursor-grabbing shadow-[0_20px_45px_-15px_rgb(46_51_73/0.45)] ring-2 ring-iris/50"
            : sortable
              ? "cursor-grab"
              : ""
        }`}
        style={{ animationDuration: "0.5s" } as CSSProperties}
      >
        {sortable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={onGripKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
          aria-label={`Reorder "${task.title}"`}
          className={`grid h-9 w-5 shrink-0 cursor-grab place-items-center rounded-md text-ink/25 transition-colors hover:text-ink/60 focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-iris group-hover:text-ink/45 ${
            isDragging ? "cursor-grabbing text-ink/60" : ""
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
            {moving && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-white">
                <ArrowDown className="gb-nudge-down size-3" aria-hidden />
                Moving to Completed
              </span>
            )}
            {schedule && status && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}
              >
                <CalendarClock className="size-3" aria-hidden />
                {status.label && <span>{status.label} ·</span>}
                {formatSchedule(schedule)}
              </span>
            )}
            {!preview && (
              <span className="text-[11px] font-medium text-ink/35 opacity-0 transition-opacity group-hover:opacity-100">
                + Add details
              </span>
            )}
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
    </li>
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
  filter: Filter;
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
      : total === 0
      ? { emoji: "🌱", title: "Your board is empty", body: "Type a task above and hit Enter to plant your first one." }
      : filter === "todo"
        ? { emoji: "🎉", title: "Nothing left to do", body: "Every task is ticked off. Enjoy the calm." }
        : { emoji: "✅", title: "Nothing ticked yet", body: "Go on, tick your first task off." };

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
