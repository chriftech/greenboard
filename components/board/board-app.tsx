"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type KeyboardEventHandler,
} from "react";
import {
  ArrowLeft,
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
import { TrashPanel } from "./trash-panel";
import {
  ScheduleFields,
  draftsToSchedule,
  formatSchedule,
  scheduleStatus,
  type DateTimeDraft,
} from "./schedule";
import {
  DEFAULT_TAG,
  TAGS,
  TRASH_DAYS,
  getServerTasks,
  getTasks,
  subscribeTasks,
  taskActions,
  type TagId,
  type Task,
} from "@/lib/tasks";

type Filter = "all" | "todo" | "done";
/** Destructive actions waiting for confirmation. */
type PendingDelete =
  | { kind: "task"; id: string; title: string } // move one task to Trash
  | { kind: "done"; count: number } // move all completed tasks to Trash
  | { kind: "forever"; id: string; title: string } // delete one trashed task for good
  | { kind: "empty"; count: number }; // delete everything in Trash for good

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
            <span className="font-semibold text-forest">&ldquo;{p.title}&rdquo;</span> and its description will be
            deleted for good. This can&apos;t be undone.
          </>
        ),
        confirmLabel: "Delete forever",
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
            <span className="font-semibold text-forest">&ldquo;{p?.title}&rdquo;</span> will move to Trash. You can
            restore it for {TRASH_DAYS} days, then it&apos;s deleted for good.
          </>
        ),
        confirmLabel: "Move to Trash",
      };
  }
}
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "Pending" },
  { id: "done", label: "Completed" },
];

const tagOf = (id: TagId) => TAGS.find((t) => t.id === id) ?? TAGS.find((t) => t.id === DEFAULT_TAG)!;

export function BoardApp() {
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const [filter, setFilter] = useState<Filter>("all");
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
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashNow, setTrashNow] = useState(0);

  function openTrash() {
    setTrashNow(Date.now()); // read the clock in the event, not during render
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
  const done = all.filter((t) => t.done);
  const todo = all.filter((t) => !t.done);
  const counts: Record<Filter, number> = { all: all.length, todo: todo.length, done: done.length };

  // Pending first, then completed; each group in the order the user dragged it into.
  const byOrder = (a: Task, b: Task) => a.order - b.order;
  todo.sort(byOrder);
  done.sort(byOrder);
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
    <div className="relative min-h-full flex-1 overflow-x-clip bg-cream text-forest">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="gb-grid-bg absolute inset-0" />
        <div className="gb-blob absolute -left-32 -top-20 size-[420px] rounded-full bg-zest/40 blur-3xl" />
        <div
          className="gb-blob absolute -right-24 top-10 size-[360px] rounded-full bg-skyblue/20 blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <header className="relative mx-auto flex max-w-3xl items-center justify-between px-4 pt-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openTrash}
            aria-label={`Trash, ${trashed.length} ${trashed.length === 1 ? "task" : "tasks"}`}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-forest/70 transition-colors hover:bg-white hover:text-forest"
          >
            <Trash2 className="size-4" />
            Trash
            {trashed.length > 0 && (
              <span className="rounded-full bg-coral px-1.5 text-[11px] font-bold text-white tabular-nums">
                {trashed.length}
              </span>
            )}
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-forest/70 transition-colors hover:bg-white hover:text-forest"
          >
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-8">
        <Summary loaded={loaded} total={all.length} doneCount={done.length} />
        <Composer />

        {/* Filters */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter tasks"
            className="relative grid grid-cols-3 rounded-2xl border border-forest/10 bg-white p-1"
          >
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-forest transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
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
                  filter === f.id ? "text-zest" : "text-forest/60 hover:text-forest"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                    filter === f.id ? "bg-white/15" : "bg-forest/5"
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
              className="text-sm font-medium text-forest/55 underline-offset-4 transition-colors hover:text-coral hover:underline"
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
                <li key={i} className="h-[68px] animate-pulse rounded-2xl bg-white/70" />
              ))}
            </ul>
          ) : visibleCount === 0 ? (
            <EmptyState filter={filter} total={all.length} />
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
                    {group.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        leaving={removingId === t.id}
                        onOpen={() => openDetails(t.id)}
                        onDelete={() => askDelete({ kind: "task", id: t.id, title: t.title })}
                      />
                    ))}
                  </SortableContext>
                ))}
              </ul>
            </DndContext>
          )}
        </section>
      </main>

      <TaskDetails
        task={selected}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onRequestDelete={(t) => askDelete({ kind: "task", id: t.id, title: t.title })}
      />

      <TrashPanel
        open={trashOpen}
        onOpenChange={setTrashOpen}
        now={trashNow}
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
        ? "Every task is ticked. Your board is fully green!"
        : `${left} ${left === 1 ? "task" : "tasks"} left — you've got this.`;

  return (
    <section className="gb-rise relative overflow-hidden rounded-[28px] bg-forest p-6 text-white shadow-[0_30px_80px_-30px_rgb(7_53_42/0.7)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="gb-blob absolute -right-16 -top-24 size-72 rounded-full bg-leaf/40 blur-3xl" />
      </div>
      <div className="relative flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-zest/80">
            {dateLabel || " "}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {greeting} <span className="inline-block origin-[70%_70%] gb-wiggle">👋</span>
          </h1>
          <p className="mt-2 flex items-center gap-2 text-white/75">
            {allDone && <PartyPopper className="size-4 shrink-0 text-zest" />}
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
              stroke="#c8f251"
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
  const [tag, setTag] = useState<TagId>(DEFAULT_TAG);
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
      className="gb-rise mt-6 rounded-[28px] border border-forest/10 bg-white p-4 shadow-[0_20px_60px_-30px_rgb(7_53_42/0.4)] sm:p-5"
      style={{ animationDelay: "120ms" }}
    >
      {/* Tag first, so it's chosen before typing the task. */}
      <div className="border-b border-forest/5 pb-4">
        <div role="radiogroup" aria-label="Tag" className="flex flex-wrap gap-1.5">
          {TAGS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tag === t.id}
              onClick={() => setTag(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                tag === t.id
                  ? `${t.chip} scale-105 border-current`
                  : "border-forest/10 text-forest/60 hover:border-forest/25"
              }`}
            >
              <span className={`size-2 rounded-full ${t.dot}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label htmlFor="new-task" className="sr-only">
        New task
      </label>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-zest">
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
          className="min-w-0 flex-1 bg-transparent font-display text-xl font-semibold placeholder:text-forest/30 focus:outline-none"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-forest/5 pt-4">
        <button
          type="button"
          onClick={() => (scheduling ? closeSchedule() : setScheduling(true))}
          aria-expanded={scheduling}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            scheduling
              ? "border-forest bg-forest text-zest"
              : "border-forest/10 text-forest/60 hover:border-forest/25 hover:text-forest"
          }`}
        >
          {scheduling ? <X className="size-3.5" /> : <CalendarClock className="size-3.5" />}
          {scheduling ? "Remove timeline" : "Add timeline"}
        </button>

        <button
          type="submit"
          disabled={!canSubmit}
          className="gb-shine inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-zest transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
        >
          Add task
        </button>
      </div>

      {scheduling && (
        <div className="gb-rise mt-4 rounded-2xl bg-cream p-3 sm:p-4" style={{ animationDuration: "0.35s" }}>
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
  leaving,
  onOpen,
  onDelete,
}: {
  task: Task;
  leaving: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [burst, setBurst] = useState(0);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  // Pointer/touch drags start anywhere on the card; keyboard drags start from the grip.
  const { onKeyDown: onGripKeyDown, ...pointerListeners } = listeners ?? {};
  const tag = tagOf(task.tag);
  const schedule = task.start && task.end ? { start: task.start, end: task.end } : null;
  const status = schedule ? scheduleStatus(schedule, task.done) : null;
  const preview = task.descriptionText?.replace(/\s+/g, " ").trim();

  function toggle() {
    if (!task.done) setBurst((b) => b + 1);
    taskActions.toggle(task.id);
  }

  return (
    <li
      ref={setNodeRef}
      {...pointerListeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative touch-manipulation ${isDragging ? "z-20" : ""}`}
    >
      {/* Inner card carries the entrance animation, which would override the li's drag transform. */}
      <div
        className={`gb-rise group flex items-center gap-2 rounded-2xl border py-3.5 pl-1.5 pr-4 transition-[box-shadow,transform,opacity,background-color,border-color] duration-300 ${
          task.done ? "border-leaf/25 bg-mint" : "border-forest/10 bg-white hover:shadow-md"
        } ${leaving ? "scale-95 opacity-0" : ""} ${
          isDragging
            ? "scale-[1.02] cursor-grabbing shadow-[0_20px_45px_-15px_rgb(7_53_42/0.45)] ring-2 ring-leaf/50"
            : "cursor-grab"
        }`}
        style={{ animationDuration: "0.5s" } as CSSProperties}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={onGripKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
          aria-label={`Reorder "${task.title}"`}
          className={`grid h-9 w-5 shrink-0 cursor-grab place-items-center rounded-md text-forest/25 transition-colors hover:text-forest/60 focus-visible:text-forest focus-visible:outline-2 focus-visible:outline-leaf group-hover:text-forest/45 ${
            isDragging ? "cursor-grabbing text-forest/60" : ""
          }`}
        >
          <GripVertical className="size-4" />
        </button>
  
        <button
          type="button"
          onClick={toggle}
          aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          aria-pressed={task.done}
          className="relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          <CheckBox done={task.done} size={28} />
          {burst > 0 && task.done && <ConfettiBurst key={burst} />}
        </button>
  
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open details for "${task.title}"`}
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf"
        >
          <p className="truncate">
            <span className="gb-strike text-base font-medium" data-done={task.done || undefined}>
              {task.title}
            </span>
          </p>
          {preview && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-forest/55">
              <NotebookPen className="size-3.5 shrink-0 text-leaf" aria-hidden />
              <span className="truncate">{preview}</span>
            </p>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tag.chip}`}>{tag.label}</span>
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
              <span className="text-[11px] font-medium text-forest/35 opacity-0 transition-opacity group-hover:opacity-100">
                + Add details
              </span>
            )}
          </span>
        </button>
  
        <ChevronRight
          aria-hidden
          className="hidden size-4 shrink-0 text-forest/25 transition-transform group-hover:translate-x-0.5 group-hover:text-forest/50 sm:block"
        />
  
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete "${task.title}"`}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-forest/35 transition-all group-hover:text-forest/60 hover:bg-coral/10 hover:text-coral! focus-visible:text-coral"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}


/* ───────────────────────── Empty states ───────────────────────── */

function EmptyState({ filter, total }: { filter: Filter; total: number }) {
  const content =
    total === 0
      ? { emoji: "🌱", title: "Your board is empty", body: "Type a task above and hit Enter to plant your first one." }
      : filter === "todo"
        ? { emoji: "🎉", title: "Nothing left to do", body: "Every task is ticked off. Enjoy the green." }
        : { emoji: "✅", title: "Nothing ticked yet", body: "Go on — tick your first task and watch it go green." };

  return (
    <div className="gb-pop flex flex-col items-center rounded-[28px] border-2 border-dashed border-forest/10 px-6 py-14 text-center">
      <span className="gb-float grid size-16 place-items-center rounded-2xl bg-white text-3xl shadow-md">
        {content.emoji}
      </span>
      <h2 className="mt-5 font-display text-xl font-bold">{content.title}</h2>
      <p className="mt-1 max-w-xs text-forest/60">{content.body}</p>
      {total === 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-forest/40">
          <ClipboardCheck className="size-3.5" />
          Tasks are saved in this browser
        </p>
      )}
    </div>
  );
}
