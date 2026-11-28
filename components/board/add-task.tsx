"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { CalendarClock, ChevronDown, CornerDownLeft, Plus, Tag as TagIcon, X } from "lucide-react";
import { DEFAULT_TAG, taskActions, type PriorityId, type TagId, type TaskStatus } from "@/lib/tasks";
import { useTags } from "@/lib/tags";
import { DONE_COLUMN, TODO_COLUMN, canMove, useBoardColumns, useWorkflow } from "@/lib/columns";
import { AssigneePicker, OptionRow, Panel, PriorityPicker, triggerClass, type Variant } from "./task-meta";
import { TagDot } from "./tag-chip";
import { ScheduleFields, draftsToSchedule, formatSchedule, type DateTimeDraft } from "./schedule";
import { RichTextEditor } from "./lazy-rich-text-editor";
import type { RichTextValue } from "./rich-text-editor";

/*
 * Adding tasks, the way a ClickUp board does it:
 *  - each column has an "Add task" card: type a name, optionally set the assignee, timeline,
 *    priority and tag from the icons under it, and press Enter. It stays open for the next one.
 *  - the "Task" button above the board opens a "Create task" window with every field, status included.
 */

/** Everything a new task can start with. */
type Draft = {
  title: string;
  tag: TagId;
  priority?: PriorityId;
  assignee?: string;
  start: DateTimeDraft;
  end: DateTimeDraft;
};

const emptyDraft = (tag: TagId): Draft => ({ title: "", tag, start: {}, end: {} });

/** The draft's tag, or Default if that tag was deleted meanwhile. */
function useDraftTag(tag: TagId) {
  const tags = useTags();
  return tags.some((t) => t.id === tag) ? tag : DEFAULT_TAG;
}

/** Columns a new task may start in: Todo, and any column the workflow lets a task move to from Todo. Never Completed. */
export function useStartColumns() {
  const columns = useBoardColumns();
  const workflow = useWorkflow();
  return columns.filter((c) => c.id !== DONE_COLUMN && (c.id === TODO_COLUMN || canMove(TODO_COLUMN, c.id, workflow)));
}

/* ───────────────────────── Pickers ───────────────────────── */

export function TagPicker({ value, onChange, variant }: { value: TagId; onChange: (tag: TagId) => void; variant: Variant }) {
  const tags = useTags();
  const [open, setOpen] = useState(false);
  const current = tags.find((t) => t.id === value) ?? tags[0];
  // In the quick-add card, the icon stays quiet while the tag is still Default.
  const picked = value !== DEFAULT_TAG;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Tag: ${current.label}`}
        title={variant === "icon" ? "Tag" : undefined}
        className={triggerClass(variant, variant === "icon" ? picked : true)}
      >
        {variant === "icon" && !picked ? <TagIcon className="size-3.5" /> : <TagDot tag={current} />}
        {(variant !== "icon" || picked) && <span className="max-w-24 truncate">{current.label}</span>}
        {variant === "field" && <ChevronDown className="size-3.5 text-ink/40" />}
      </Popover.Trigger>
      <Panel label="Choose a tag">
        <div role="listbox" aria-label="Tag">
          {tags.map((t) => (
            <OptionRow
              key={t.id}
              selected={t.id === value}
              onSelect={() => {
                onChange(t.id);
                setOpen(false);
              }}
            >
              <TagDot tag={t} className="size-2.5" />
              {t.label}
            </OptionRow>
          ))}
        </div>
      </Panel>
    </Popover.Root>
  );
}

/** Start and end, in a small panel. "Done" keeps them; the trigger shows them once complete. */
export function TimelinePicker({
  start,
  end,
  onChange,
  variant,
}: {
  start: DateTimeDraft;
  end: DateTimeDraft;
  onChange: (start: DateTimeDraft, end: DateTimeDraft) => void;
  variant: Variant;
}) {
  const [open, setOpen] = useState(false);
  const schedule = draftsToSchedule(start, end);
  const set = schedule !== null && schedule !== "invalid";
  const label = set ? formatSchedule(schedule) : variant === "field" ? "No timeline" : "Timeline";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Timeline: ${set ? label : "none"}`}
        title={variant === "icon" ? "Timeline" : undefined}
        className={`${triggerClass(variant, set)} ${schedule === "invalid" ? "border-coral/60 text-coral" : ""}`}
      >
        <CalendarClock className={variant === "field" ? "size-4 text-ink/50" : "size-3.5"} />
        {(variant !== "icon" || set) && <span className="max-w-56 truncate">{label}</span>}
        {variant === "field" && <ChevronDown className="size-3.5 text-ink/40" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start" collisionPadding={12} className="z-[70]">
          <Popover.Popup
            aria-label="Set a timeline"
            className="w-[min(27.5rem,calc(100vw-1.5rem))] origin-(--transform-origin) rounded-2xl border border-ink/10 bg-surface p-3 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            <ScheduleFields start={start} end={end} onChange={onChange} />
            <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-ink/5 pt-3">
              {(start.date || start.time || end.date || end.time) && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({}, {});
                    setOpen(false);
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-deep px-3 py-1.5 text-xs font-semibold text-on-deep"
              >
                Done
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ───────────────────────── A column's "Add task" card ───────────────────────── */

/**
 * The card a column opens for a new task. `at` says where the task lands: the top of the
 * column (its header's +) or the bottom (the "Add task" under its tasks), matching where the card sits.
 */
export function InlineAddTask({
  status,
  label,
  at,
  defaultTag,
  onClose,
}: {
  status: TaskStatus;
  /** The column's name, for screen readers. */
  label: string;
  at: "top" | "bottom";
  /** The board's tag filter, if any, so the new task stays in view. */
  defaultTag?: TagId;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultTag ?? DEFAULT_TAG));
  const tag = useDraftTag(draft.tag);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const schedule = draftsToSchedule(draft.start, draft.end);
  const canSave = !!draft.title.trim() && schedule !== "invalid";
  const touched = draft.title.trim() || draft.priority || draft.assignee || tag !== (defaultTag ?? DEFAULT_TAG) || schedule;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    taskActions.add({
      title: draft.title,
      tag,
      status,
      position: at,
      priority: draft.priority,
      assignee: draft.assignee,
      schedule: schedule ?? undefined,
    });
    // Ready for the next one, keeping nothing but the tag (like typing several into one list).
    setDraft({ ...emptyDraft(tag) });
    inputRef.current?.focus();
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      // Clicking away closes an untouched card; one with something typed stays until saved or cancelled.
      // React passes events up from the pickers' portals too, so only the card's own elements count here.
      onBlur={(e) => {
        if (!formRef.current?.contains(e.target as Node)) return;
        const next = e.relatedTarget as Node | null;
        if (next && formRef.current.contains(next)) return;
        // Pickers open in a portal outside the card; moving into one isn't leaving the card.
        if (next instanceof Element && next.closest("[data-side],[role=dialog],[role=listbox]")) return;
        if (!touched) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && formRef.current?.contains(e.target as Node)) onClose();
      }}
      className="gb-pop rounded-xl border border-iris/40 bg-white p-2.5 shadow-[0_8px_24px_-12px_rgb(46_51_73/0.35)] dark:bg-surface"
    >
      <label className="sr-only" htmlFor={`add-task-${status}-${at}`}>
        New task in {label}
      </label>
      <input
        ref={inputRef}
        id={`add-task-${status}-${at}`}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="Task name"
        autoComplete="off"
        autoFocus
        maxLength={140}
        className="w-full bg-transparent px-0.5 py-0.5 text-sm font-semibold placeholder:font-medium placeholder:text-ink/35 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <AssigneePicker value={draft.assignee} onChange={(assignee) => setDraft({ ...draft, assignee })} variant="icon" />
        <TimelinePicker
          start={draft.start}
          end={draft.end}
          onChange={(start, end) => setDraft({ ...draft, start, end })}
          variant="icon"
        />
        <PriorityPicker value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} variant="icon" />
        <TagPicker value={tag} onChange={(t) => setDraft({ ...draft, tag: t })} variant="icon" />
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 border-t border-ink/5 pt-2">
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
    </form>
  );
}

/* ───────────────────────── "Create task" window ───────────────────────── */

/** The board's main "Task" button. */
export function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour="new-task"
      aria-keyshortcuts="t"
      title="Create a task (T)"
      className="gb-shine inline-flex flex-1 flex-col justify-center gap-1 py-2 text-[11px] sm:flex-none sm:flex-row sm:gap-1.5 sm:py-1.5 sm:text-sm items-center rounded-xl bg-iris px-3 font-semibold text-white shadow-[0_8px_20px_-10px_rgb(79_107_237/0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
    >
      <Plus className="size-4" strokeWidth={3} />
      Task
    </button>
  );
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultTag,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTag?: TagId;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-[12vh] z-[61] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 rounded-[24px] border border-ink/10 bg-surface text-ink shadow-[0_30px_80px_-20px_rgb(46_51_73/0.5)] outline-none transition-all duration-200 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {/* Remount each time, so it opens empty. */}
          {open && <CreateTaskForm defaultTag={defaultTag} onDone={() => onOpenChange(false)} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CreateTaskForm({ defaultTag, onDone }: { defaultTag?: TagId; onDone: () => void }) {
  const columns = useStartColumns();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultTag ?? DEFAULT_TAG));
  const [status, setStatus] = useState<TaskStatus>(TODO_COLUMN);
  const [description, setDescription] = useState<RichTextValue>({ html: "", text: "" });
  const tag = useDraftTag(draft.tag);
  const column = columns.find((c) => c.id === status) ?? columns[0];
  const schedule = draftsToSchedule(draft.start, draft.end);
  const canSave = !!draft.title.trim() && schedule !== "invalid";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    taskActions.add({
      title: draft.title,
      tag,
      status: column.id,
      priority: draft.priority,
      assignee: draft.assignee,
      schedule: schedule ?? undefined,
      description: description.text ? description : undefined,
    });
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-center justify-between gap-3 border-b border-ink/5 px-5 py-3.5">
        <Dialog.Title className="font-display text-lg font-bold">Create task</Dialog.Title>
        <Dialog.Close
          aria-label="Close"
          className="grid size-8 place-items-center rounded-lg text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X className="size-4" />
        </Dialog.Close>
      </div>
      <Dialog.Description className="sr-only">
        Name the task, then optionally pick its status, assignee, timeline, priority and tag.
      </Dialog.Description>

      <div className="px-5 pt-4">
        <label htmlFor="create-task-name" className="sr-only">
          Task name
        </label>
        <input
          id="create-task-name"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Task name"
          autoComplete="off"
          autoFocus
          maxLength={140}
          className="w-full bg-transparent font-display text-2xl font-bold placeholder:text-ink/25 focus:outline-none"
        />
        {/* Rich text, with the same formatting shortcuts as a task's details. ⌘/Ctrl+Enter creates the task. */}
        <div
          className="mt-3"
          onKeyDownCapture={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.closest("form")?.requestSubmit();
            }
          }}
        >
          <RichTextEditor compact placeholder="Add a description" onChange={setDescription} />
        </div>
      </div>

      {/* The fields, in a row of small buttons like the card in each column, with Status first. */}
      <div className="flex flex-wrap items-center gap-1.5 px-5 pb-4">
        <StatusPicker columns={columns} value={column.id} onChange={setStatus} />
        <AssigneePicker value={draft.assignee} onChange={(assignee) => setDraft({ ...draft, assignee })} variant="pill" />
        <TimelinePicker
          start={draft.start}
          end={draft.end}
          onChange={(start, end) => setDraft({ ...draft, start, end })}
          variant="pill"
        />
        <PriorityPicker value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} variant="pill" />
        <TagPicker value={tag} onChange={(t) => setDraft({ ...draft, tag: t })} variant="pill" />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-b-[24px] border-t border-ink/5 bg-paper/50 px-5 py-3">
        <p className="hidden text-xs text-ink/45 sm:block">
          <Kbd>Enter</Kbd> to create
        </p>
        <button
          type="submit"
          disabled={!canSave}
          className="ml-auto rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-on-deep transition-opacity disabled:opacity-40"
        >
          Create task
        </button>
      </div>
    </form>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-ink/15 bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold">{children}</kbd>;
}

function StatusPicker({
  columns,
  value,
  onChange,
}: {
  columns: ReturnType<typeof useStartColumns>;
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = columns.find((c) => c.id === value) ?? columns[0];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={`Status: ${current.label}`} className={triggerClass("pill", true)}>
        <span aria-hidden className={`size-2.5 rounded-full ${current.dot}`} />
        <span className="max-w-32 truncate uppercase tracking-wide">{current.label}</span>
        <ChevronDown className="size-3.5 text-ink/40" />
      </Popover.Trigger>
      <Panel label="Choose a status">
        <div role="listbox" aria-label="Status">
          {columns.map((c) => (
            <OptionRow
              key={c.id}
              selected={c.id === value}
              onSelect={() => {
                onChange(c.id);
                setOpen(false);
              }}
            >
              <span aria-hidden className={`size-2.5 rounded-full ${c.dot}`} />
              {c.label}
            </OptionRow>
          ))}
        </div>
      </Panel>
    </Popover.Root>
  );
}
