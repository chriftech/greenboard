"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, FileDown, FileUp, SlidersHorizontal } from "lucide-react";
import { PRIORITIES, getServerTasks, getTasks, statusOf, subscribeTasks, type TagId } from "@/lib/tasks";
import { useBoardColumns } from "@/lib/columns";
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
    <div role="toolbar" aria-label="Filter, add columns, import and export tasks" className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-ink/10 bg-surface/70 p-2 shadow-[0_10px_30px_-18px_rgb(46_51_73/0.45)] sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      {/* Phones: the filters are a centred segmented bar on their own row. Wider screens: on the left, in line with the actions. */}
      {!empty && (
        <div className="flex w-full flex-col items-center gap-1.5 sm:w-auto sm:flex-row sm:gap-2">
          <span className="mr-1 hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink/45 sm:inline-flex">
            <SlidersHorizontal className="size-3.5" />
            Filter
          </span>

          <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-ink/[0.06] p-1 sm:flex sm:w-auto sm:gap-2 sm:bg-transparent sm:p-0">
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
          </div>

          {anyActive && (
            <button
              type="button"
              onClick={onClear}
              className="px-1 text-xs font-semibold text-ink/50 underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Add column, Import and Export stay together at the far right. On phones they take their own row,
          spread evenly across it, with icons only. */}
      <div className="flex w-full items-stretch gap-2 sm:ml-auto sm:w-auto sm:items-center">
        {addColumn}
        <button
          type="button"
          onClick={onImport}
          title="Add tasks from a CSV file"
          aria-label="Import from CSV"
          className="inline-flex flex-1 flex-col justify-center gap-1 py-2 text-[11px] sm:flex-none sm:flex-row sm:gap-1.5 sm:py-1.5 sm:text-sm items-center rounded-xl border border-ink/15 bg-surface px-2.5 font-semibold text-ink transition-colors hover:border-ink/30 sm:px-3.5"
        >
          <FileUp className="size-4" />
          <span>Import</span>
        </button>

        {/* All tasks (like "Export tasks as CSV" in the profile menu) or one status, whatever the filters. */}
        {!empty && <ExportMenu />}
      </div>
    </div>
  );
}

/** Export as CSV: every task first, then one status (column) at a time. */
function ExportMenu() {
  const columns = useBoardColumns();
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const onBoard = (tasks ?? []).filter((t) => !t.deletedAt);
  const countOf = (id: string) => onBoard.filter((t) => statusOf(t) === id).length;
  const item =
    "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-ink/80 outline-none transition-colors data-highlighted:bg-mist data-highlighted:text-ink data-disabled:cursor-default data-disabled:opacity-40";
  const count = "rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink/55";

  return (
    <Menu.Root>
      <Menu.Trigger
        title="Download tasks as a CSV file"
        aria-label="Export as CSV"
        className="inline-flex flex-1 flex-col justify-center gap-1 py-2 text-[11px] sm:flex-none sm:flex-row sm:gap-1.5 sm:py-1.5 sm:text-sm items-center rounded-xl bg-deep px-2.5 font-semibold text-on-deep transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris sm:px-3.5"
      >
        <FileDown className="size-4" />
        <span>Export</span>
        <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-40">
          <Menu.Popup className="max-h-[min(24rem,var(--available-height))] w-60 origin-(--transform-origin) overflow-y-auto rounded-2xl border border-ink/10 bg-surface p-1.5 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Menu.Item className={item} onClick={() => downloadTasksCsv()}>
              <FileDown className="size-4 shrink-0 text-ink/50" />
              <span className="min-w-0 flex-1 truncate font-semibold">All tasks</span>
              <span className={count}>{onBoard.length}</span>
            </Menu.Item>
            <Menu.Separator className="mx-2 my-1 h-px bg-ink/10" />
            <Menu.Group>
              <Menu.GroupLabel className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink/45">
                By status
              </Menu.GroupLabel>
              {columns.map((c) => {
                const n = countOf(c.id);
                return (
                  <Menu.Item key={c.id} className={item} disabled={n === 0} onClick={() => downloadTasksCsv(c.id)}>
                    <span aria-hidden className="grid size-4 shrink-0 place-items-center">
                      <span className={`size-2.5 rounded-full ${c.dot}`} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className={count}>{n}</span>
                  </Menu.Item>
                );
              })}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
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
        className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris sm:justify-start sm:rounded-xl sm:px-3 sm:py-1.5 sm:data-popup-open:border-iris/50 ${
          on
            ? "border-transparent bg-surface text-ink shadow-[0_2px_8px_-3px_rgb(46_51_73/0.35)] sm:border-iris/40 sm:bg-iris/10 sm:shadow-none"
            : "border-transparent text-ink/70 hover:text-ink data-popup-open:bg-surface data-popup-open:text-ink sm:border-ink/15 sm:bg-surface sm:hover:border-ink/30"
        }`}
      >
        {/* On phones a chosen filter shows just its value, so it fits a third of the row. */}
        <span className={on ? "hidden text-ink/55 sm:inline" : ""}>{label}</span>
        {on && <span className="inline-flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap font-semibold">{value}</span>}
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
