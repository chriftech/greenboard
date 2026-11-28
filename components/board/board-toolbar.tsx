"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { CalendarRange, Check, ChevronDown, ChevronLeft, FileDown, FileUp, SlidersHorizontal } from "lucide-react";
import { PRIORITIES, getServerTasks, getTasks, statusOf, subscribeTasks, todayKey, type TagId } from "@/lib/tasks";
import { useBoardColumns } from "@/lib/columns";
import type { TagView } from "@/lib/tags";
import { ME, boardUsesAssignees, type Person } from "@/lib/people";
import { downloadTasksCsv } from "@/lib/export";
import { TagDot } from "./tag-chip";
import { CALENDAR_THEME, Calendar, loadCalendar } from "./schedule";
import { ANY_DATE, DATE_PRESETS, dateFilterLabel, dateRangeOf, type DateFilter } from "@/lib/date-filter";

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
  date: DateFilter;
  onDateChange: (date: DateFilter) => void;
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
  date,
  onDateChange,
  onClear,
  onImport,
  addColumn,
  empty,
}: Props) {
  const activeTag = tag ? tags.find((t) => t.id === tag) : undefined;
  const activePriority = PRIORITIES.find((p) => p.id === priority);
  const everyone = [ME, ...people];
  const activePerson = everyone.find((p) => p.id === assignee);
  const anyActive = Boolean(activeTag) || priority !== ANY || assignee !== ANY || date.kind !== "any";

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

          <DateFilterMenu value={date} onChange={onDateChange} />

          {boardUsesAssignees() && (
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
          )}
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

/** A filter button: outlined when off, tinted when something is picked. */
const filterTriggerClass = (on: boolean) =>
  `inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris sm:justify-start sm:rounded-xl sm:px-3 sm:py-1.5 sm:data-popup-open:border-iris/50 ${
    on
      ? "border-transparent bg-surface text-ink shadow-[0_2px_8px_-3px_rgb(46_51_73/0.35)] sm:border-iris/40 sm:bg-iris/10 sm:shadow-none"
      : "border-transparent text-ink/70 hover:text-ink data-popup-open:bg-surface data-popup-open:text-ink sm:border-ink/15 sm:bg-surface sm:hover:border-ink/30"
  }`;

const POPUP_CLASS =
  "origin-(--transform-origin) rounded-2xl border border-ink/10 bg-surface p-1.5 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0";

const ROW_CLASS = "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors";

/** "YYYY-MM-DD" → a local Date at midnight. */
const dayOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * The Date filter: presets (Today, This week, …), No date, or a custom range picked on a calendar.
 * It's a popover rather than a menu so the calendar can take clicks and arrow keys.
 */
function DateFilterMenu({ value, onChange }: { value: DateFilter; onChange: (value: DateFilter) => void }) {
  const [open, setOpen] = useState(false);
  // The custom range calendar, and the days picked on it so far.
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date }>({});
  const label = dateFilterLabel(value);

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Reopening shows the custom calendar again if a custom range is on, starting from it.
      setCustom(value.kind === "range");
      const range = value.kind === "range" ? dateRangeOf(value) : null;
      setDraft(range ? { from: dayOf(range.from), to: dayOf(range.to) } : {});
    }
  }

  function pick(next: DateFilter) {
    onChange(next);
    setOpen(false);
  }

  const row = (selected: boolean, text: string, onClick: () => void, key?: string) => (
    <button
      key={key ?? text}
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={`${ROW_CLASS} ${selected ? "bg-mist text-ink" : "text-ink/75 hover:bg-mist hover:text-ink"}`}
    >
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <Check className={`size-4 shrink-0 text-iris ${selected ? "" : "invisible"}`} />
    </button>
  );

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger
        aria-label={label ? `Date: ${label}` : "Date"}
        onPointerEnter={loadCalendar}
        onFocus={loadCalendar}
        className={filterTriggerClass(label !== null)}
      >
        <span className={label ? "hidden text-ink/55 sm:inline" : ""}>Date</span>
        {label && <span className="min-w-0 overflow-hidden whitespace-nowrap font-semibold">{label}</span>}
        <ChevronDown className="size-3.5 shrink-0 text-ink/45" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" collisionPadding={12} className="z-40">
          <Popover.Popup aria-label="Filter by date" style={CALENDAR_THEME} className={`${POPUP_CLASS} ${custom ? "" : "w-52"}`}>
            {!custom ? (
              <div role="menu" aria-label="Date">
                {row(value.kind === "any", "Any date", () => pick(ANY_DATE))}
                {DATE_PRESETS.map((p) =>
                  row(value.kind === "preset" && value.preset === p.id, p.label, () => pick({ kind: "preset", preset: p.id }), p.id),
                )}
                {row(value.kind === "none", "No date", () => pick({ kind: "none" }))}
                <div className="mx-2 my-1 h-px bg-ink/10" />
                <button
                  type="button"
                  onClick={() => setCustom(true)}
                  className={`${ROW_CLASS} ${value.kind === "range" ? "bg-mist text-ink" : "text-ink/75 hover:bg-mist hover:text-ink"}`}
                >
                  <CalendarRange className="size-4 shrink-0 text-ink/50" />
                  <span className="min-w-0 flex-1 truncate">Custom range…</span>
                  <Check className={`size-4 shrink-0 text-iris ${value.kind === "range" ? "" : "invisible"}`} />
                </button>
              </div>
            ) : (
              <div className="w-[17.5rem]">
                <div className="flex items-center gap-1 px-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setCustom(false)}
                    aria-label="Back to date options"
                    className="grid size-7 place-items-center rounded-lg text-ink/55 transition-colors hover:bg-mist hover:text-ink"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-sm font-semibold">Custom range</p>
                </div>
                <Calendar
                  mode="range"
                  selected={draft.from ? { from: draft.from, to: draft.to } : undefined}
                  defaultMonth={draft.from}
                  onSelect={(r) => setDraft({ from: r?.from, to: r?.to })}
                  className="mx-auto"
                />
                <div className="flex items-center justify-between gap-2 border-t border-ink/10 px-1.5 pb-0.5 pt-2">
                  <p className="min-w-0 truncate text-xs text-ink/55">
                    {draft.from
                      ? dateFilterLabel({
                          kind: "range",
                          from: todayKey(draft.from),
                          to: todayKey(draft.to ?? draft.from),
                        })
                      : "Pick the first and last day"}
                  </p>
                  <button
                    type="button"
                    disabled={!draft.from}
                    onClick={() =>
                      draft.from &&
                      pick({ kind: "range", from: todayKey(draft.from), to: todayKey(draft.to ?? draft.from) })
                    }
                    className="shrink-0 rounded-lg bg-deep px-3 py-1.5 text-xs font-semibold text-on-deep transition-opacity disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

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
        className={filterTriggerClass(on)}
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
