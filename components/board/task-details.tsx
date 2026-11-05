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
import { TAGS, taskActions, type Task } from "@/lib/tasks";

/** Slide-in panel for viewing and editing one task, including its description. */
export function TaskDetails({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open && !!task} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent
        className="bg-cream text-forest"
        style={{ "--drawer-content-width": "min(34rem, 100vw)" } as CSSProperties}
      >
        {/* Remount per task so the editor starts from that task's description. */}
        {task && <DetailsBody key={task.id} task={task} onClose={() => onOpenChange(false)} />}
      </DrawerContent>
    </Drawer>
  );
}

function DetailsBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);

  function commitTitle() {
    if (title.trim() && title.trim() !== task.title) taskActions.update(task.id, { title });
    else setTitle(task.title);
  }

  function remove() {
    onClose();
    // Let the panel slide out before the task disappears.
    setTimeout(() => taskActions.remove(task.id), 250);
  }

  const created = new Date(task.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-forest/10 px-5 py-4">
        <DrawerTitle className="text-xs font-semibold uppercase tracking-widest text-forest/50">
          Task details
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Edit the task title, tag, due date and description.
        </DrawerDescription>
        <DrawerClose
          aria-label="Close details"
          className="grid size-9 place-items-center rounded-xl text-forest/60 transition-colors hover:bg-white hover:text-forest"
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
              className={`field-sizing-content w-full resize-none rounded-xl bg-transparent px-2 py-1 font-display text-2xl font-bold leading-snug transition-colors hover:bg-white focus:bg-white focus:outline-2 focus:outline-leaf ${
                task.done ? "text-forest/50 line-through" : ""
              }`}
            />
          </label>
        </div>

        {/* Tag */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-forest/50">Tag</p>
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
                    : "border-forest/10 bg-white text-forest/60 hover:border-forest/25"
                }`}
              >
                <span className={`size-2 rounded-full ${t.dot}`} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-forest/50">Due date</p>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-forest/10 bg-white px-3 py-2 text-sm font-medium focus-within:border-leaf">
              <CalendarClock className="size-4 text-forest/50" />
              <span className="sr-only">Due date</span>
              <input
                type="date"
                value={task.due ?? ""}
                onChange={(e) => taskActions.update(task.id, { due: e.target.value })}
                className="bg-transparent focus:outline-none"
              />
            </label>
            {task.due && (
              <button
                type="button"
                onClick={() => taskActions.update(task.id, { due: "" })}
                className="text-sm font-medium text-forest/50 hover:text-coral"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-forest/50">
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
          <p className="mt-2 text-xs text-forest/40">Saved automatically</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-forest/10 px-5 py-4">
        <p className="text-xs text-forest/45">Created {created}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-coral transition-colors hover:bg-coral/10"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
          <DrawerClose className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-zest transition-transform hover:-translate-y-0.5">
            Done
          </DrawerClose>
        </div>
      </div>
    </div>
  );
}
