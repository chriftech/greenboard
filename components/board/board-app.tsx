"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, CalendarClock, ClipboardCheck, PartyPopper, Plus, Trash2 } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { CheckBox, ConfettiBurst } from "@/components/landing/check-box";
import {
  TAGS,
  getServerTasks,
  getTasks,
  subscribeTasks,
  taskActions,
  todayKey,
  type TagId,
  type Task,
} from "@/lib/tasks";

type Filter = "all" | "todo" | "done";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To do" },
  { id: "done", label: "Done" },
];

const tagOf = (id: TagId) => TAGS.find((t) => t.id === id) ?? TAGS[0];

export function BoardApp() {
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const [filter, setFilter] = useState<Filter>("all");

  const loaded = tasks !== null;
  const all = tasks ?? [];
  const done = all.filter((t) => t.done);
  const todo = all.filter((t) => !t.done);
  const counts: Record<Filter, number> = { all: all.length, todo: todo.length, done: done.length };

  // Active first (newest first), then done (most recently ticked first).
  const sorted = [
    ...todo.sort((a, b) => b.createdAt - a.createdAt),
    ...done.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
  ];
  const visible = filter === "all" ? sorted : filter === "todo" ? todo : done;

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
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-forest/70 transition-colors hover:bg-white hover:text-forest"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-8">
        <Summary loaded={loaded} total={all.length} doneCount={done.length} />
        {/* Dates are only read once loaded in the browser, never during prerender. */}
        <Composer minDue={loaded ? todayKey() : undefined} />

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
              onClick={() => taskActions.clearDone()}
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
          ) : visible.length === 0 ? (
            <EmptyState filter={filter} total={all.length} />
          ) : (
            <ul className="space-y-3">
              {visible.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </section>
      </main>
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

function Composer({ minDue }: { minDue?: string }) {
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<TagId>("work");
  const [due, setDue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    taskActions.add({ title, tag, due });
    setTitle("");
    setDue("");
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={submit}
      className="gb-rise mt-6 rounded-[28px] border border-forest/10 bg-white p-4 shadow-[0_20px_60px_-30px_rgb(7_53_42/0.4)] sm:p-5"
      style={{ animationDelay: "120ms" }}
    >
      <label htmlFor="new-task" className="sr-only">
        New task
      </label>
      <div className="flex items-center gap-3">
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

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-forest/5 pt-4">
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

        <label className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-forest/10 px-3 py-1.5 text-xs font-semibold text-forest/60 focus-within:border-leaf">
          <CalendarClock className="size-3.5" />
          <span className="sr-only">Due date</span>
          <input
            type="date"
            value={due}
            min={minDue}
            onChange={(e) => setDue(e.target.value)}
            className="bg-transparent text-forest focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={!title.trim()}
          className="gb-shine inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-zest transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
        >
          Add task
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────── Task row ───────────────────────── */

function dueBadge(due: string) {
  const today = todayKey();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = todayKey(tomorrowDate);

  if (due < today) return { label: "Overdue", cls: "bg-coral text-white" };
  if (due === today) return { label: "Today", cls: "bg-sunny text-forest" };
  if (due === tomorrow) return { label: "Tomorrow", cls: "bg-mint text-forest" };
  const [y, m, d] = due.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return { label, cls: "bg-forest/5 text-forest/70" };
}

function TaskRow({ task }: { task: Task }) {
  const [burst, setBurst] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const tag = tagOf(task.tag);
  const badge = task.due && !task.done ? dueBadge(task.due) : null;

  function toggle() {
    if (!task.done) setBurst((b) => b + 1);
    taskActions.toggle(task.id);
  }

  function remove() {
    setLeaving(true);
    setTimeout(() => taskActions.remove(task.id), 220);
  }

  function commitEdit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== task.title) taskActions.rename(task.id, draft);
    else setDraft(task.title);
  }

  return (
    <li
      className={`gb-rise group flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
        task.done ? "border-leaf/25 bg-mint" : "border-forest/10 bg-white hover:shadow-md"
      } ${leaving ? "scale-95 opacity-0" : ""}`}
      style={{ animationDuration: "0.5s" } as CSSProperties}
    >
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

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={140}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") {
                setDraft(task.title);
                setEditing(false);
              }
            }}
            aria-label="Edit task"
            className="w-full rounded-lg bg-cream px-2 py-1 text-base font-medium focus:outline-2 focus:outline-leaf"
          />
        ) : (
          <p
            onDoubleClick={() => !task.done && setEditing(true)}
            title={task.done ? undefined : "Double-click to edit"}
            className="truncate"
          >
            <span className="gb-strike text-base font-medium" data-done={task.done || undefined}>
              {task.title}
            </span>
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tag.chip}`}>{tag.label}</span>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={remove}
        aria-label={`Delete "${task.title}"`}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-forest/40 transition-all hover:bg-coral/10 hover:text-coral focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
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
