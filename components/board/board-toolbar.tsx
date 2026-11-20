"use client";

import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, FileDown, FileUp, SlidersHorizontal } from "lucide-react";
import { PRIORITIES, type TagId } from "@/lib/tasks";
import type { TagView } from "@/lib/tags";
import { ME, type Person } from "@/lib/people";
import { downloadTasksCsv } from "@/lib/export";
import { TagDot } from "./tag-chip";

import type { AssigneeFilter, PriorityFilter } from "@/lib/workspace";

const ANY = "any";
const NONE = "none";

type Props = {
  tags: TagView[];
  people: Person[];
  tag: TagId | null;
  onTagChange: (tag: TagId | null) => void;
  priority: PriorityFilter;
  onPriorityChange: (priority: PriorityFilter) => void;
  assignee: AssigneeFilter;
  onAssigneeChange: (assignee: AssigneeFilter) => void;
  onClear: () => void;
  onImport: () => void;
  /** The "Add column" button, shown with Import and Export. */
  addColumn?: ReactNode;
  /** No tasks yet: just Import (filters and Export have nothing to work on). */
  empty: boolean;
};

/** The row above the columns: filters on the left, Import and Export on the far right. */
export function BoardToolbar({
  tags,
  people,
  tag,
  onTagChange,
  priority,
  onPriorityChange,
  assignee,
  onAssigneeChange,
  onClear,
  onImport,
  addColumn,
  empty,
}: Props) {
  const activeTag = tag ? tags.find((t) => t.id === tag) : undefined;
  const activePriority = PRIORITIES.find((p) => p.id === priority);
  const everyone = [ME, ...people];
  const activePerson = everyone.find((p) => p.id === assignee);
  const anyActive = Boolean(activeTag) || priority !== ANY || assignee !== ANY;

  return (
    <div role="toolbar" aria-label="Filter, add columns, import and export tasks" className="mb-4 flex flex-wrap items-center gap-2">
      {!empty && (
        <>
          <span className="mr-1 hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink/45 sm:inline-flex">
            <SlidersHorizontal className="size-3.5" />
            Filter
          </span>

          <FilterMenu
            label="Tag"
            value={activeTag ? <><TagDot tag={activeTag} />{activeTag.label}</> : null}
            selected={tag ?? ANY}
            onSelect={(v) => onTagChange(v === ANY ? null : v)}
            options={[
              { value: ANY, label: "All tags" },
              ...tags.map((t) => ({ value: t.id, label: t.label, icon: <TagDot tag={t} /> })),
            ]}
          />

          <FilterMenu
            label="Priority"
            value={priority === NONE ? "None" : activePriority ? <><PriorityDot color={activePriority.color} />{activePriority.label}</> : null}
            selected={priority}
            onSelect={(v) => onPriorityChange(v as PriorityFilter)}
            options={[
              { value: ANY, label: "Any priority" },
              ...PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: <PriorityDot color={p.color} /> })),
              { value: NONE, label: "No priority" },
            ]}
          />

          <FilterMenu
            label="Assignee"
            value={assignee === NONE ? "Unassigned" : activePerson ? activePerson.name : null}
            selected={assignee}
            onSelect={onAssigneeChange}
            options={[
              { value: ANY, label: "Anyone" },
              ...everyone.map((p) => ({ value: p.id, label: p.name })),
              { value: NONE, label: "Unassigned" },
            ]}
          />

          {anyActive && (
            <button
              type="button"
              onClick={onClear}
              className="px-1 text-xs font-semibold text-ink/50 underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Clear filters
            </button>
          )}
        </>
      )}

      {/* Add column, Import and Export stay together at the far right (and wrap together on narrow screens). Icons only on phones. */}
      <div className="ml-auto flex items-center gap-2">
        {addColumn}
        <button
          type="button"
          onClick={onImport}
          title="Add tasks from a CSV file"
          aria-label="Import from CSV"
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink/15 bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink/30 sm:px-3.5"
        >
          <FileUp className="size-4" />
          <span className="hidden sm:inline">Import</span>
        </button>

        {/* Same as "Export tasks as CSV" in the profile menu: the whole board, whatever the filters. */}
        {!empty && (
          <button
            type="button"
            onClick={() => downloadTasksCsv()}
            title="Download every task on your board as a CSV file"
            aria-label="Export as CSV"
            className="inline-flex items-center gap-1.5 rounded-xl bg-deep px-2.5 py-1.5 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5 sm:px-3.5"
          >
            <FileDown className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>
    </div>
  );
}

function PriorityDot({ color }: { color: string }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

type Option = { value: string; label: string; icon?: ReactNode };

function FilterMenu({
  label,
  value,
  selected,
  onSelect,
  options,
}: {
  label: string;
  /** What's picked, shown on the button; null when the filter is off. */
  value: ReactNode;
  selected: string;
  onSelect: (value: string) => void;
  options: Option[];
}) {
  const on = value !== null;
  return (
    <Menu.Root>
      <Menu.Trigger
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris data-popup-open:border-iris/50 ${
          on ? "border-iris/40 bg-iris/10 text-ink" : "border-ink/15 bg-surface text-ink/70 hover:border-ink/30 hover:text-ink"
        }`}
      >
        <span className={on ? "text-ink/55" : ""}>{label}</span>
        {on && <span className="inline-flex items-center gap-1.5 font-semibold">{value}</span>}
        <ChevronDown className="size-3.5 text-ink/45" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-40">
          <Menu.Popup className="max-h-[min(22rem,var(--available-height))] w-52 origin-(--transform-origin) overflow-y-auto rounded-2xl border border-ink/10 bg-surface p-1.5 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Menu.RadioGroup value={selected} onValueChange={(v) => onSelect(String(v))}>
              {options.map((o) => (
                <Menu.RadioItem
                  key={o.value}
                  value={o.value}
                  closeOnClick
                  className="flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-ink/80 outline-none transition-colors data-highlighted:bg-mist data-highlighted:text-ink"
                >
                  {o.icon && <span className="grid size-4 place-items-center">{o.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  <Menu.RadioItemIndicator className="text-iris">
                    <Check className="size-4" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
