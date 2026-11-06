"use client";

import { useState, type CSSProperties } from "react";
import { CalendarClock, Trash2, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CheckBox } from "@/components/landing/check-box";
import { RichTextEditor } from "./rich-text-editor";
import { ScheduleFields, draftsToSchedule, toDraft, type DateTimeDraft } from "./schedule";
import { TAGS, taskActions, type Task } from "@/lib/tasks";

/** Slide-in panel for viewing and editing one task, including its description. */
export function TaskDetails({
  task,
  open,
  onOpenChange,
  onRequestDelete,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDelete: (task: Task) => void;
}) {
  return (
    <Drawer open={open && !!task} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent
        className="bg-paper text-ink"
        style={{ "--drawer-content-width": "min(34rem, 100vw)" } as CSSProperties}
      >
        {/* Remount per task so the editor starts from that task's description. */}
        {task && <DetailsBody key={task.id} task={task} onDelete={() => onRequestDelete(task)} />}
      </DrawerContent>
    </Drawer>
  );
}

function DetailsBody({ task, onDelete }: { task: Task; onDelete: () => void }) {
  const [title, setTitle] = useState(task.title);

  function commitTitle() {
    if (title.trim() && title.trim() !== task.title) taskActions.update(task.id, { title });
    else setTitle(task.title);
  }

  const created = new Date(task.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <DrawerTitle className="text-xs font-semibold uppercase tracking-widest text-ink/50">
          Task details
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Edit the task title, tag, timeline and description.
        </DrawerDescription>
        <DrawerClose
          aria-label="Close details"
          className="grid size-9 place-items-center rounded-xl text-ink/60 transition-colors hover:bg-white hover:text-ink"
        >
          <X className="size-5" />
        </DrawerClose>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
        {/* Title + done */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => taskActions.toggle(task.id)}
            aria-label={task.done ? "Mark as not done" : "Mark as done"}
            aria-pressed={task.done}
            className="mt-1.5 rounded-full"
          >
            <CheckBox done={task.done} size={28} />
          </button>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Task title</span>
            <textarea
              value={title}
              rows={1}
              maxLength={140}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") setTitle(task.title);
              }}
              className={`field-sizing-content w-full resize-none rounded-xl bg-transparent px-2 py-1 font-display text-2xl font-bold leading-snug transition-colors hover:bg-white focus:bg-white focus:outline-2 focus:outline-iris ${
                task.done ? "text-ink/50 line-through" : ""
              }`}
            />
          </label>
        </div>

        {/* Tag */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink/50">Tag</p>
          <div role="radiogroup" aria-label="Tag" className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={task.tag === t.id}
                onClick={() => taskActions.update(task.id, { tag: t.id })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  task.tag === t.id
                    ? `${t.chip} border-current`
                    : "border-ink/10 bg-white text-ink/60 hover:border-ink/25"
                }`}
              >
                <span className={`size-2 rounded-full ${t.dot}`} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink/50">Timeline</p>
          <ScheduleEditor task={task} />
        </div>

        {/* Description */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink/50">
            Description
          </p>
          <RichTextEditor
            initialHtml={task.description}
            onChange={({ html, text }) =>
              taskActions.update(task.id, {
                description: html || undefined,
                descriptionText: text || undefined,
              })
            }
          />
          <p className="mt-2 text-xs text-ink/40">Saved automatically</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-5 py-4">
        <p className="text-xs text-ink/45">Created {created}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-coral transition-colors hover:bg-coral/10"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
          <DrawerClose className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5">
            Done
          </DrawerClose>
        </div>
      </div>
    </div>
  );
}

/**
 * Start/end editor. Changes save as soon as both have a date and a time and
 * the end is after the start; until then the previous schedule is kept.
 */
function ScheduleEditor({ task }: { task: Task }) {
  const [open, setOpen] = useState(!!(task.start && task.end));
  const [start, setStart] = useState<DateTimeDraft>(() => toDraft(task.start));
  const [end, setEnd] = useState<DateTimeDraft>(() => toDraft(task.end));
  const draft = draftsToSchedule(start, end);
  const saved = draft !== "invalid" && draft !== null;

  function change(s: DateTimeDraft, e: DateTimeDraft) {
    setStart(s);
    setEnd(e);
    const next = draftsToSchedule(s, e);
    if (next !== "invalid" && next !== null) taskActions.setSchedule(task.id, next);
  }

  function remove() {
    setStart({});
    setEnd({});
    setOpen(false);
    taskActions.setSchedule(task.id, null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-ink/20 bg-white px-3 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-iris hover:text-ink"
      >
        <CalendarClock className="size-4" />
        Add timeline
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-3">
      <ScheduleFields start={start} end={end} onChange={change} />
      <div className="mt-3 flex items-center justify-between pl-[5.5rem]">
        <p className="text-xs text-ink/45">
          {saved ? "Saved automatically" : task.start ? "Not saved until both are complete" : "\u00a0"}
        </p>
        <button
          type="button"
          onClick={remove}
          className="text-xs font-semibold text-ink/50 transition-colors hover:text-coral"
        >
          Remove timeline
        </button>
      </div>
    </div>
  );
}
