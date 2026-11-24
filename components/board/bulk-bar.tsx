"use client";

import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { ArrowRightLeft, CircleCheckBig, FileDown, Flag, Tag, Trash2, UserRound, X } from "lucide-react";
import { PRIORITIES, type PriorityId, type TagId, type TaskStatus } from "@/lib/tasks";
import type { BoardColumn } from "@/lib/columns";
import type { TagView } from "@/lib/tags";
import type { Person } from "@/lib/people";
import { TagDot } from "./tag-chip";
import { Avatar, PriorityFlag } from "./task-meta";

const ITEM =
  "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-ink/80 outline-none transition-colors data-highlighted:bg-mist data-highlighted:text-ink";

/**
 * The floating bar shown while tasks are selected (like ClickUp's): how many
 * are selected, and actions that apply to all of them at once.
 */
export function BulkBar({
  count,
  columns,
  tags,
  people,
  onClear,
  onMove,
  onTag,
  onPriority,
  onAssignee,
  onComplete,
  onExport,
  onDelete,
}: {
  count: number;
  columns: BoardColumn[];
  tags: TagView[];
  people: Person[];
  onClear: () => void;
  onMove: (column: TaskStatus) => void;
  onTag: (tag: TagId) => void;
  onPriority: (priority: PriorityId | null) => void;
  onAssignee: (personId: string | null) => void;
  onComplete: () => void;
  /** Download the selected tasks as a CSV file. */
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label={`${count} selected ${count === 1 ? "task" : "tasks"}`}
      // Floats over the board, detached from the page, above the sidebar and below panels and dialogs.
      className="gb-bulk-bar fixed inset-x-0 bottom-5 z-40 mx-auto flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-2xl bg-[#2b2f36] p-1.5 text-white shadow-[0_18px_50px_-12px_rgb(0_0_0/0.55)] ring-1 ring-white/10"
    >
      <span className="flex shrink-0 items-center gap-1 pl-1 pr-1.5">
        <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-iris px-1.5 text-xs font-bold tabular-nums">
          {count}
        </span>
        <span className="hidden text-sm font-semibold sm:inline">selected</span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection (Esc)"
          className="ml-0.5 grid size-7 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </span>

      <span aria-hidden className="h-6 w-px shrink-0 bg-white/15" />

      {/* Actions scroll sideways on narrow screens rather than wrapping. */}
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        <BarMenu icon={<ArrowRightLeft className="size-4" />} label="Move to">
          {columns.map((c) => (
            <Menu.Item key={c.id} className={ITEM} onClick={() => onMove(c.id)}>
              <span className={`size-2.5 shrink-0 rounded-full ${c.dot}`} />
              {c.label}
            </Menu.Item>
          ))}
        </BarMenu>

        <BarMenu icon={<Tag className="size-4" />} label="Tag">
          {tags.map((t) => (
            <Menu.Item key={t.id} className={ITEM} onClick={() => onTag(t.id)}>
              <TagDot tag={t} className="size-2.5" />
              {t.label}
            </Menu.Item>
          ))}
        </BarMenu>

        <BarMenu icon={<Flag className="size-4" />} label="Priority">
          {PRIORITIES.map((p) => (
            <Menu.Item key={p.id} className={ITEM} onClick={() => onPriority(p.id)}>
              <PriorityFlag priority={p.id} />
              {p.label}
            </Menu.Item>
          ))}
          <Menu.Item className={ITEM} onClick={() => onPriority(null)}>
            <PriorityFlag />
            No priority
          </Menu.Item>
        </BarMenu>

        <BarMenu icon={<UserRound className="size-4" />} label="Assignee">
          {people.map((p) => (
            <Menu.Item key={p.id} className={ITEM} onClick={() => onAssignee(p.id)}>
              <Avatar person={p} size={20} />
              <span className="truncate">{p.name}</span>
            </Menu.Item>
          ))}
          <Menu.Item className={ITEM} onClick={() => onAssignee(null)}>
            <span className="grid size-5 place-items-center rounded-full border border-dashed border-ink/30">
              <UserRound className="size-3 text-ink/40" />
            </span>
            Unassigned
          </Menu.Item>
        </BarMenu>

        <BarMenu icon={<FileDown className="size-4" />} label="Export">
          <Menu.Item className={ITEM} onClick={onExport}>
            <FileDown className="size-4 shrink-0 text-ink/50" />
            <span className="min-w-0 flex-1 truncate">Selected tasks (CSV)</span>
            <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink/55">
              {count}
            </span>
          </Menu.Item>
        </BarMenu>

        <BarButton icon={<CircleCheckBig className="size-4" />} label="Complete" onClick={onComplete} />
        <BarButton icon={<Trash2 className="size-4" />} label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  );
}

function BarButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
        danger ? "text-[#ff8a78] hover:bg-coral/20" : "text-white/85 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      <span className="sr-only md:hidden">{label}</span>
    </button>
  );
}

/** A bar button that opens a menu above the bar. */
function BarMenu({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white data-popup-open:bg-white/10 data-popup-open:text-white"
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
        <span className="sr-only md:hidden">{label}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" sideOffset={10} align="start" className="z-50">
          <Menu.Popup className="max-h-[min(20rem,var(--available-height))] w-56 origin-(--transform-origin) overflow-y-auto rounded-2xl border border-ink/10 bg-surface p-1.5 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink/45">{label}</p>
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
