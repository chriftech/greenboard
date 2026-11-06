"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { TRASH_DAYS, taskActions, trashDaysLeft, type Task } from "@/lib/tasks";
import { findTag, useTags } from "@/lib/tags";
import { TagChip } from "./tag-chip";

/** Slide-in panel listing trashed tasks, with restore and delete-forever actions. */
export function TrashPanel({
  open,
  onOpenChange,
  tasks,
  onDeleteForever,
  onEmptyTrash,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tasks currently in Trash. */
  tasks: Task[];
  onDeleteForever: (task: Task) => void;
  onEmptyTrash: () => void;
}) {
  // Clear out anything whose 30 days ran out while the page was open.
  useEffect(() => {
    if (open) taskActions.purgeExpired();
  }, [open]);

  const sorted = [...tasks].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent
        className="bg-paper text-ink"
        style={{ "--drawer-content-width": "min(30rem, 100vw)" } as CSSProperties}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
            <div>
              <DrawerTitle className="font-display text-xl font-bold text-ink">Trash</DrawerTitle>
              <DrawerDescription className="mt-0.5 text-sm text-ink/55">
                Deleted tasks stay here for {TRASH_DAYS} days, then they&apos;re deleted for good.
              </DrawerDescription>
            </div>
            <DrawerClose
              aria-label="Close trash"
              className="grid size-9 shrink-0 place-items-center rounded-xl text-ink/60 transition-colors hover:bg-surface hover:text-ink"
            >
              <X className="size-5" />
            </DrawerClose>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {!open ? null : sorted.length === 0 ? (
              <div className="flex flex-col items-center rounded-[28px] border-2 border-dashed border-ink/10 px-6 py-14 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-surface text-ink/40 shadow-sm">
                  <Trash2 className="size-6" />
                </span>
                <p className="mt-4 font-display text-lg font-bold">Trash is empty</p>
                <p className="mt-1 max-w-xs text-sm text-ink/55">
                  Tasks you delete will show up here for {TRASH_DAYS} days in case you need them back.
                </p>
              </div>
            ) : (
              <TrashList tasks={sorted} onDeleteForever={onDeleteForever} />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-5 py-4">
            <p className="text-xs text-ink/45">
              {sorted.length} {sorted.length === 1 ? "task" : "tasks"} in Trash
            </p>
            <button
              type="button"
              onClick={onEmptyTrash}
              disabled={sorted.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-coral transition-colors hover:bg-coral/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Trash2 className="size-4" />
              Empty trash
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Mounted only while the panel is open, so it reads the clock once per opening
 * (for "days left") instead of on every render.
 */
function TrashList({ tasks, onDeleteForever }: { tasks: Task[]; onDeleteForever: (task: Task) => void }) {
  const [now] = useState(() => Date.now());
  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <TrashRow key={t.id} task={t} now={now} onDeleteForever={() => onDeleteForever(t)} />
      ))}
    </ul>
  );
}

function TrashRow({ task, now, onDeleteForever }: { task: Task; now: number; onDeleteForever: () => void }) {
  const tag = findTag(useTags(), task.tag);
  const left = trashDaysLeft(task, now);
  const deleted = new Date(task.deletedAt ?? now).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

  return (
    <li className="rounded-2xl border border-ink/10 bg-surface px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${task.done ? "text-ink/50 line-through" : ""}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <TagChip tag={tag} className="text-[11px]" />
            <span className="text-ink/45">Deleted {deleted}</span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                left <= 3 ? "bg-coral text-white" : left <= 7 ? "bg-sunny text-on-accent" : "bg-ink/5 text-ink/60"
              }`}
            >
              {left === 0 ? "Deleted today" : `${left} ${left === 1 ? "day" : "days"} left`}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => taskActions.restore(task.id)}
          aria-label={`Restore "${task.title}"`}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-iris transition-colors hover:bg-mist"
        >
          <RotateCcw className="size-4" />
          Restore
        </button>
        <button
          type="button"
          onClick={onDeleteForever}
          aria-label={`Delete "${task.title}" forever`}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-coral transition-colors hover:bg-coral/10"
        >
          <Trash2 className="size-4" />
          Delete forever
        </button>
      </div>
    </li>
  );
}
