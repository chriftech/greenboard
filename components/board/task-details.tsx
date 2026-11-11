"use client";

import { useState, useSyncExternalStore, type CSSProperties, type ComponentType, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
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
import { taskActions, type Task } from "@/lib/tasks";
import { findTag, useTags } from "@/lib/tags";
import { TagRadio } from "./tag-chip";

/* ───────────────────────── Mobile vs larger screens ───────────────────────── */

/** Phones (under 768px) get the slide-in drawer; larger screens get a centred modal. */
const MOBILE_QUERY = "(max-width: 47.99rem)";

function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True on phone-sized screens; follows resizes and rotation. */
function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/** The title/description/close parts differ between the drawer and the modal. */
type Parts = {
  Title: ComponentType<{ className?: string; children?: ReactNode }>;
  Description: ComponentType<{ className?: string; children?: ReactNode }>;
  Close: ComponentType<{ className?: string; children?: ReactNode; "aria-label"?: string }>;
};

const DRAWER_PARTS: Parts = { Title: DrawerTitle, Description: DrawerDescription, Close: DrawerClose };
const DIALOG_PARTS: Parts = { Title: Dialog.Title, Description: Dialog.Description, Close: Dialog.Close };

/**
 * View and edit one task, including its description: a slide-in drawer on
 * phones and a centred modal on tablets and desktops.
 */
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
  const mobile = useIsMobile();
  const isOpen = open && !!task;
  // Remount per task so the editor starts from that task's description.
  const body = (parts: Parts) =>
    task && <DetailsBody key={task.id} task={task} parts={parts} onDelete={() => onRequestDelete(task)} />;

  if (mobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange} swipeDirection="right">
        <DrawerContent
          className="bg-paper text-ink"
          style={{ "--drawer-content-width": "min(34rem, 100vw)" } as CSSProperties}
        >
          {body(DRAWER_PARTS)}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Same layer as the drawer (z-50): delete confirmation (z-60) and the calendar (z-70) sit above. */}
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100vw-3rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-ink/10 bg-paper text-ink shadow-[0_30px_80px_-20px_rgb(46_51_73/0.5)] outline-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.9,0.3,1.1)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {body(DIALOG_PARTS)}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DetailsBody({ task, parts, onDelete }: { task: Task; parts: Parts; onDelete: () => void }) {
  const { Title, Description, Close } = parts;
  const tags = useTags();
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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <Title className="text-xs font-semibold uppercase tracking-widest text-ink/50">Task details</Title>
        <Description className="sr-only">Edit the task title, tag, timeline and description.</Description>
        <Close
          aria-label="Close details"
          className="grid size-9 place-items-center rounded-xl text-ink/60 transition-colors hover:bg-surface hover:text-ink"
        >
          <X className="size-5" />
        </Close>
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
              className={`field-sizing-content w-full resize-none rounded-xl bg-transparent px-2 py-1 font-display text-2xl font-bold leading-snug transition-colors hover:bg-surface focus:bg-surface focus:outline-2 focus:outline-iris ${
                task.done ? "text-ink/50 line-through" : ""
              }`}
            />
          </label>
        </div>

        {/* Tag */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink/50">Tag</p>
          <div role="radiogroup" aria-label="Tag" className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <TagRadio
                key={t.id}
                tag={t}
                checked={findTag(tags, task.tag).id === t.id}
                onSelect={() => taskActions.update(task.id, { tag: t.id })}
                idleClassName="bg-surface"
              />
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
          <Close className="rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5">
            Done
          </Close>
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
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-ink/20 bg-surface px-3 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-iris hover:text-ink"
      >
        <CalendarClock className="size-4" />
        Add timeline
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface p-3">
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
