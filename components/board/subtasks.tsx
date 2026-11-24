"use client";

import { useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, CornerDownLeft, ListTree, Plus, Trash2 } from "lucide-react";
import { CheckBox } from "@/components/landing/check-box";
import { PRIORITIES, subtaskProgress, taskActions, type PriorityId, type Subtask, type Task } from "@/lib/tasks";
import { AssigneeBadge, AssigneePicker, PriorityFlag, PriorityPicker } from "./task-meta";
import { TimelinePicker } from "./add-task";
import { draftsToSchedule, formatSchedule, toDraft, type DateTimeDraft } from "./schedule";

/*
 * Subtasks, the way ClickUp does them:
 *  - the task window has a Subtasks section: a progress bar, one row per subtask with its own
 *    tick, assignee, timeline and priority, and "Add subtask" for a quick inline row.
 *  - a board card with subtasks shows a "1/3" button; it opens the list right under the card,
 *    where subtasks can be ticked and new ones added without opening the task.
 */

/* ───────────────────────── Progress ───────────────────────── */

function ProgressBar({ done, total, className = "" }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span aria-hidden className={`block h-1.5 overflow-hidden rounded-full bg-ink/10 ${className}`}>
      <span className="block h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** The card's subtask button: "1/3", which opens or closes the list under the card. */
export function SubtaskToggle({ task, open, onToggle }: { task: Task; open: boolean; onToggle: () => void }) {
  const { done, total } = subtaskProgress(task);
  if (!total) return null;
  const all = done === total;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${done} of ${total} subtasks done. ${open ? "Hide" : "Show"} subtasks`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-iris ${
        open ? "bg-iris/15 text-iris" : all ? "bg-success/15 text-success" : "bg-ink/5 text-ink/65 hover:bg-ink/10 hover:text-ink"
      }`}
    >
      <ListTree className="size-3" aria-hidden />
      {done}/{total}
      {open ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />}
    </button>
  );
}

/* ───────────────────────── One subtask ───────────────────────── */

/** Start and end for a saved subtask: saves once both are complete, and clears when emptied. */
function SubtaskTimeline({ taskId, sub }: { taskId: string; sub: Subtask }) {
  const [start, setStart] = useState<DateTimeDraft>(() => toDraft(sub.start));
  const [end, setEnd] = useState<DateTimeDraft>(() => toDraft(sub.end));
  return (
    <TimelinePicker
      start={start}
      end={end}
      variant="icon"
      onChange={(s, e) => {
        setStart(s);
        setEnd(e);
        const next = draftsToSchedule(s, e);
        if (next === null) taskActions.setSubtaskSchedule(taskId, sub.id, null);
        else if (next !== "invalid") taskActions.setSubtaskSchedule(taskId, sub.id, next);
      }}
    />
  );
}

/** A subtask row in the task window: tick, editable name, pickers and delete. */
function SubtaskRow({ taskId, sub }: { taskId: string; sub: Subtask }) {
  const [title, setTitle] = useState(sub.title);

  function commit() {
    if (title.trim() && title.trim() !== sub.title) taskActions.updateSubtask(taskId, sub.id, { title });
    else setTitle(sub.title);
  }

  return (
    <li className="group/sub flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-2 py-1.5 transition-colors hover:bg-ink/[0.03] focus-within:bg-ink/[0.03]">
      <button
        type="button"
        onClick={() => taskActions.toggleSubtask(taskId, sub.id)}
        aria-label={sub.done ? `Untick "${sub.title}"` : `Tick "${sub.title}"`}
        aria-pressed={sub.done}
        className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
      >
        <CheckBox done={sub.done} size={18} />
      </button>
      <label className="min-w-0 flex-1 basis-40">
        <span className="sr-only">Subtask name</span>
        <input
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              // Undo the edit without closing the task window.
              e.stopPropagation();
              setTitle(sub.title);
              requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
            }
          }}
          className={`w-full rounded-md bg-transparent px-1 py-0.5 text-sm font-medium focus:bg-surface focus:outline-2 focus:outline-iris ${
            sub.done ? "text-ink/45 line-through" : ""
          }`}
        />
      </label>
      <div className="flex items-center gap-1">
        <AssigneePicker
          value={sub.assignee}
          onChange={(assignee) => taskActions.updateSubtask(taskId, sub.id, { assignee })}
          variant="icon"
        />
        <SubtaskTimeline taskId={taskId} sub={sub} />
        <PriorityPicker
          value={sub.priority}
          onChange={(priority) => taskActions.updateSubtask(taskId, sub.id, { priority })}
          variant="icon"
        />
        <button
          type="button"
          onClick={() => taskActions.deleteSubtask(taskId, sub.id)}
          aria-label={`Delete subtask "${sub.title}"`}
          className="grid size-7 place-items-center rounded-lg text-ink/35 opacity-0 transition-[opacity,color] hover:bg-coral/10 hover:text-coral focus-visible:opacity-100 group-hover/sub:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

/* ───────────────────────── Adding ───────────────────────── */

type Draft = { title: string; assignee?: string; priority?: PriorityId; start: DateTimeDraft; end: DateTimeDraft };
const emptyDraft = (): Draft => ({ title: "", start: {}, end: {} });

/**
 * The inline row for a new subtask. Enter saves it and stays open for the next one;
 * Escape, Cancel, or clicking away with nothing typed closes it.
 */
function AddSubtaskRow({ taskId, compact = false, onClose }: { taskId: string; compact?: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const schedule = draftsToSchedule(draft.start, draft.end);
  const canSave = !!draft.title.trim() && schedule !== "invalid";
  const touched = draft.title.trim() || draft.assignee || draft.priority || schedule;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    taskActions.addSubtask(taskId, {
      title: draft.title,
      assignee: draft.assignee,
      priority: draft.priority,
      schedule: schedule ?? undefined,
    });
    setDraft(emptyDraft());
    inputRef.current?.focus();
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onBlur={(e) => {
        if (!formRef.current?.contains(e.target as Node)) return;
        const next = e.relatedTarget as Node | null;
        if (next && formRef.current.contains(next)) return;
        // The pickers open in a portal; moving into one isn't leaving the row.
        if (next instanceof Element && next.closest("[data-side],[role=listbox]")) return;
        if (!touched) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && formRef.current?.contains(e.target as Node)) {
          // Close just this row, not the task window around it.
          e.stopPropagation();
          onClose();
        }
      }}
      className={`gb-pop rounded-xl border border-iris/40 bg-white dark:bg-surface ${compact ? "p-2" : "p-2.5"}`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-[18px] shrink-0 rounded-full border-2 border-dashed border-ink/25" />
        <label className="sr-only" htmlFor={`add-subtask-${taskId}-${compact ? "card" : "details"}`}>
          New subtask
        </label>
        <input
          ref={inputRef}
          id={`add-subtask-${taskId}-${compact ? "card" : "details"}`}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Subtask name"
          autoComplete="off"
          autoFocus
          maxLength={140}
          className="min-w-0 flex-1 bg-transparent py-0.5 text-sm font-medium placeholder:text-ink/35 focus:outline-none"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 pl-[26px]">
        <AssigneePicker value={draft.assignee} onChange={(assignee) => setDraft({ ...draft, assignee })} variant="icon" />
        <TimelinePicker
          start={draft.start}
          end={draft.end}
          onChange={(start, end) => setDraft({ ...draft, start, end })}
          variant="icon"
        />
        <PriorityPicker value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} variant="icon" />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex items-center gap-1 rounded-lg bg-deep px-2.5 py-1 text-xs font-semibold text-on-deep transition-opacity disabled:opacity-40"
          >
            Save
            <CornerDownLeft aria-hidden className="size-3 opacity-70" />
          </button>
        </div>
      </div>
    </form>
  );
}

function AddSubtaskButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink ${
        compact ? "px-1.5 py-1 text-xs" : "px-2 py-1.5 text-sm"
      }`}
    >
      <Plus className={compact ? "size-3.5" : "size-4"} />
      Add subtask
    </button>
  );
}

/* ───────────────────────── In the task window ───────────────────────── */

export function SubtasksSection({ task }: { task: Task }) {
  const [adding, setAdding] = useState(false);
  const list = task.subtasks ?? [];
  const { done, total } = subtaskProgress(task);

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink/50">Subtasks</p>
        {total > 0 && (
          <>
            <ProgressBar done={done} total={total} className="w-24" />
            <span className="text-xs font-semibold text-ink/50">
              {done}/{total}
            </span>
          </>
        )}
      </div>
      <div className="rounded-2xl border border-ink/10 bg-surface p-1.5">
        {list.length > 0 && (
          <ul aria-label="Subtasks" className="flex flex-col">
            {list.map((s) => (
              <SubtaskRow key={s.id} taskId={task.id} sub={s} />
            ))}
          </ul>
        )}
        {adding ? (
          <div className={list.length ? "mt-1" : ""}>
            <AddSubtaskRow taskId={task.id} onClose={() => setAdding(false)} />
          </div>
        ) : (
          <AddSubtaskButton onClick={() => setAdding(true)} />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Under a board card ───────────────────────── */

/**
 * The card's open subtask list: tick them and add more here; a name opens the task.
 * `startAdding` opens the new-subtask row right away (the card's "Add subtask" button).
 */
export function CardSubtasks({
  task,
  startAdding = false,
  onOpenTask,
  onClose,
}: {
  task: Task;
  startAdding?: boolean;
  onOpenTask: () => void;
  /** Called when the list is left empty and the add row closes. */
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(startAdding);
  const list = task.subtasks ?? [];

  return (
    // Drags start anywhere on a card; inside the list, presses are for typing and ticking instead.
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="mt-2.5 border-t border-ink/5 pt-2"
    >
      {list.length > 0 && (
        <ul aria-label={`Subtasks of "${task.title}"`} className="flex flex-col gap-0.5">
          {list.map((s) => {
            const schedule = s.start && s.end ? { start: s.start, end: s.end } : null;
            return (
              <li key={s.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-ink/[0.03]">
                <button
                  type="button"
                  onClick={() => taskActions.toggleSubtask(task.id, s.id)}
                  aria-label={s.done ? `Untick "${s.title}"` : `Tick "${s.title}"`}
                  aria-pressed={s.done}
                  className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                  <CheckBox done={s.done} size={16} />
                </button>
                <button
                  type="button"
                  onClick={onOpenTask}
                  title={schedule ? formatSchedule(schedule) : undefined}
                  className={`min-w-0 flex-1 truncate rounded text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-iris ${
                    s.done ? "text-ink/45 line-through" : "text-ink/80"
                  }`}
                >
                  {s.title}
                </button>
                {s.priority && (
                  <span title={`${PRIORITIES.find((p) => p.id === s.priority)?.label} priority`}>
                    <PriorityFlag priority={s.priority} className="size-3" />
                  </span>
                )}
                <AssigneeBadge assignee={s.assignee} />
              </li>
            );
          })}
        </ul>
      )}
      <div className={list.length ? "mt-1" : ""}>
        {adding ? (
          <AddSubtaskRow
            taskId={task.id}
            compact
            onClose={() => {
              setAdding(false);
              if (!list.length) onClose();
            }}
          />
        ) : (
          <AddSubtaskButton compact onClick={() => setAdding(true)} />
        )}
      </div>
    </div>
  );
}
