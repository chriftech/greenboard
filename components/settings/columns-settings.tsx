"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CircleCheck, Columns3, GitBranch, GripVertical, Lock, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  COLUMN_COLORS,
  DONE_COLUMN,
  MAX_COLUMN_LABEL,
  MAX_EXTRA_COLUMNS,
  TODO_COLUMN,
  canMove,
  columnActions,
  useBoardColumns,
  useTickColumn,
  useWorkflow,
  type BoardColumn,
  type ColumnColor,
} from "@/lib/columns";
import { getServerTasks, getTasks, statusOf, subscribeTasks, taskActions } from "@/lib/tasks";
import { useHydrated } from "@/lib/hydrated";
import { ConfirmDialog } from "@/components/board/confirm-dialog";

const card =
  "mt-3 divide-y divide-ink/10 overflow-hidden rounded-[24px] border border-ink/10 bg-surface shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)]";

/** The board's columns: add, rename, recolour, reorder and delete (Todo and Completed are fixed). */
export function ColumnsSettings() {
  const hydrated = useHydrated();
  const columns = useBoardColumns();
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const [deleting, setDeleting] = useState<BoardColumn | null>(null);

  const onBoard = (tasks ?? []).filter((t) => t.deletedAt === undefined);
  const countIn = (id: string) => (tasks ?? []).filter((t) => statusOf(t) === id).length;
  const extra = columns.length - 2;
  const deletingCount = deleting ? countIn(deleting.id) : 0;
  const firstLabel = columns[0]?.label ?? "Todo";
  const tickColumn = useTickColumn();
  const tickLabel = columns.find((c) => c.id === tickColumn)?.label ?? "Completed";

  return (
    <section aria-labelledby="columns-settings" className="gb-rise" style={{ animationDelay: "180ms" }}>
      <h2 id="columns-settings" className="px-1 text-xs font-semibold uppercase tracking-widest text-ink/50">
        Columns
      </h2>

      {!hydrated ? (
        <div className={card} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-5">
              <span className="size-9 animate-pulse rounded-xl bg-ink/10" />
              <span className="h-4 w-40 animate-pulse rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      ) : (
        <div className={card}>
          <div className="flex items-start gap-4 p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mist text-iris">
              <Columns3 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Your board&rsquo;s columns</p>
              <p className="mt-0.5 text-sm text-ink/60">
                Left to right. {firstLabel} is where new tasks start; {tickLabel} is where ticked tasks go. Add up to{" "}
                {MAX_EXTRA_COLUMNS} columns in between.
              </p>
            </div>
          </div>

          <ColumnOrderStrip columns={columns} />

          <ol aria-label="Columns" className="divide-y divide-ink/10">
            {columns.map((c, i) => (
              <ColumnRow
                key={`${c.id}:${c.label}`}
                column={c}
                count={onBoard.filter((t) => statusOf(t) === c.id).length}
                canMoveUp={!c.fixed && i > 1}
                canMoveDown={!c.fixed && i < columns.length - 2}
                onDelete={() => setDeleting(c)}
              />
            ))}
          </ol>

          <TickColumnPicker columns={columns} value={tickColumn} />

          {extra < MAX_EXTRA_COLUMNS ? (
            <AddColumn />
          ) : (
            <p className="p-5 text-sm text-ink/55">That&rsquo;s the most columns a board can have. Delete one to add another.</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the “${deleting?.label ?? ""}” column?`}
        description={
          deletingCount === 0
            ? `No tasks are in it. Any workflow moves to or from it are removed too.${deleting?.id === tickColumn ? " Ticked tasks will go to Completed again." : ""}`
            : `${deletingCount} ${deletingCount === 1 ? "task" : "tasks"} in it (Trash included) will move to ${firstLabel}. Any workflow moves to or from it are removed too.${deleting?.id === tickColumn ? " Ticked tasks will go to Completed again." : ""}`
        }
        confirmLabel="Delete column"
        onConfirm={() => {
          if (!deleting) return;
          taskActions.moveColumn(deleting.id, TODO_COLUMN);
          columnActions.remove(deleting.id);
          setDeleting(null);
        }}
      />
    </section>
  );
}

/**
 * Wider screens: the columns in a row, as on the board. Drag one left or right to reorder
 * (or focus its handle and use the arrow keys). Todo and Completed are locked at the ends.
 * Phones use the arrows on each row instead.
 */
function ColumnOrderStrip({ columns }: { columns: BoardColumn[] }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const movable = columns.filter((c) => !c.fixed);
  const ids = movable.map((c) => c.id);
  const first = columns[0];
  const last = columns[columns.length - 1];
  const labelOf = (id: unknown) => columns.find((c) => c.id === id)?.label ?? "Column";

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    columnActions.reorder(arrayMove(ids, from, to));
  }

  return (
    <div className="hidden bg-paper/50 px-5 py-4 md:block">
      <p className="text-sm font-semibold">Board order</p>
      <p className="mt-0.5 text-xs text-ink/50">
        Drag a column left or right to move it on your board. {first?.label} and {last?.label} stay at the ends.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable: "To move a column, press space or enter, use the left and right arrow keys, then press space or enter again to drop it.",
          },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}.`,
            onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} is over ${labelOf(over.id)}.` : `${labelOf(active.id)} is not over a column.`),
            onDragEnd: ({ active, over }) => (over ? `${labelOf(active.id)} dropped.` : `${labelOf(active.id)} was not moved.`),
            onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} was cancelled.`,
          },
        }}
      >
        <ol aria-label="Board order" className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-1">
          {first && <OrderChip column={first} />}
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            {movable.map((c) => (
              <SortableOrderChip key={c.id} column={c} />
            ))}
          </SortableContext>
          {last && last !== first && <OrderChip column={last} />}
        </ol>
      </DndContext>
    </div>
  );
}

const chip = "flex min-w-[8.5rem] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold";

/** Todo or Completed: shown in place, not draggable. */
function OrderChip({ column }: { column: BoardColumn }) {
  return (
    <li className={`${chip} border-ink/10 bg-surface/60 text-ink/60`} title={`${column.label} stays ${column.fixed === "first" ? "first" : "last"}`}>
      <Lock aria-hidden className="size-3.5 shrink-0 text-ink/35" />
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${column.dot}`} />
      <span className="truncate">{column.label}</span>
    </li>
  );
}

function SortableOrderChip({ column }: { column: BoardColumn }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={`Move ${column.label}`}
      className={`${chip} cursor-grab touch-none border-ink/15 bg-surface outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-iris ${
        isDragging ? "relative z-10 cursor-grabbing shadow-lg ring-2 ring-iris/50" : "hover:border-ink/30"
      }`}
    >
      <GripVertical aria-hidden className="size-4 shrink-0 text-ink/35" />
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${column.dot}`} />
      <span className="truncate">{column.label}</span>
    </li>
  );
}

function ColumnRow({
  column,
  count,
  canMoveUp,
  canMoveDown,
  onDelete,
}: {
  column: BoardColumn;
  count: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: () => void;
}) {
  const id = useId();
  const locked = column.id === DONE_COLUMN;
  const tickColumn = useTickColumn();
  const tickHere = tickColumn === column.id;
  const columns = useBoardColumns();
  const [draft, setDraft] = useState(column.label);
  const [editingColor, setEditingColor] = useState(false);

  function saveLabel() {
    const clean = draft.trim();
    if (!clean) return setDraft(column.label);
    if (clean !== column.label) columnActions.update(column.id, { label: clean });
  }

  const iconButton =
    "grid size-9 place-items-center rounded-xl text-ink/55 transition-colors enabled:hover:bg-mist enabled:hover:text-ink disabled:opacity-30";

  return (
    <li className="p-4 sm:px-5">
      <div className="flex items-center gap-3">
        {locked ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success/15" title="Completed is fixed">
            <span aria-hidden className={`size-3 rounded-full ${column.dot}`} />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditingColor((v) => !v)}
            aria-expanded={editingColor}
            aria-label={`Colour of ${column.label}`}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-ink/10 transition-colors hover:border-ink/30"
          >
            <span aria-hidden className={`size-3 rounded-full ${column.dot}`} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          {locked ? (
            <p className="truncate px-1 font-semibold">{column.label}</p>
          ) : (
            <>
              <label htmlFor={id} className="sr-only">
                Column name
              </label>
              <input
                id={id}
                value={draft}
                maxLength={MAX_COLUMN_LABEL}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setDraft(column.label);
                    e.currentTarget.blur();
                  }
                }}
                className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 font-semibold outline-none transition-colors hover:border-ink/15 focus:border-iris focus:bg-paper"
              />
            </>
          )}
          <p className="px-1 text-xs text-ink/50">
            {column.id === TODO_COLUMN
              ? "First · new tasks start here"
              : `${locked ? "Last · done tasks" : `${count} ${count === 1 ? "task" : "tasks"}`}${tickHere ? " · ticked tasks go here" : ""}`}
          </p>
        </div>

        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink/50">
            <Lock className="size-3" />
            Fixed
          </span>
        ) : column.fixed ? null : (
          <div className="flex items-center">
            <button type="button" disabled={!canMoveUp} onClick={() => columnActions.move(column.id, -1)} aria-label={`Move ${column.label} earlier`} title="Move earlier (left on the board)" className={`${iconButton} md:hidden`}>
              <ArrowUp className="size-4" />
            </button>
            <button type="button" disabled={!canMoveDown} onClick={() => columnActions.move(column.id, 1)} aria-label={`Move ${column.label} later`} title="Move later (right on the board)" className={`${iconButton} md:hidden`}>
              <ArrowDown className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${column.label}`}
              title="Delete column"
              className="grid size-9 place-items-center rounded-xl text-ink/55 transition-colors hover:bg-coral/10 hover:text-coral"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Where ticking a task in this column sends it. Not for Completed (tasks there are done), or the tick column (ticking unticks there). */}
      {!locked && !tickHere && (
        <div className="mt-2 pl-12">
          <TickToSelect
            compact
            columns={columns}
            exclude={column.id}
            value={column.tickTo ?? ""}
            defaultLabel={columns.find((c) => c.id === tickColumn)?.label ?? "Completed"}
            onChange={(to) => columnActions.update(column.id, { tickTo: to || null })}
          />
        </div>
      )}

      {editingColor && !locked && (
        <ColorPicker
          value={column.color}
          onChange={(color) => {
            columnActions.update(column.id, { color });
            setEditingColor(false);
          }}
          className="mt-3 pl-12"
        />
      )}
    </li>
  );
}

export function ColorPicker({
  value,
  onChange,
  className = "",
}: {
  value: ColumnColor;
  onChange: (color: ColumnColor) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Column colour" className={`flex flex-wrap gap-2 ${className}`}>
      {COLUMN_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(c.id)}
          className={`grid size-8 place-items-center rounded-full border-2 transition-colors ${
            value === c.id ? "border-ink" : "border-transparent hover:border-ink/25"
          }`}
        >
          <span aria-hidden className={`size-5 rounded-full ${c.dot}`} />
        </button>
      ))}
    </div>
  );
}

function AddColumn() {
  const id = useId();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<ColumnColor>("sky");
  const columns = useBoardColumns();
  const tickColumn = useTickColumn();
  const [tickTo, setTickTo] = useState(tickColumn);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (columnActions.add(label, color, { tickTo })) {
      setLabel("");
      setTickTo(tickColumn);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 bg-paper/50 p-5">
      <label htmlFor={id} className="text-sm font-semibold">
        Add a column
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={label}
          maxLength={MAX_COLUMN_LABEL}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. In review"
          className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink/35 focus:border-iris"
        />
        <button
          type="submit"
          disabled={!label.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-deep px-4 py-2.5 text-sm font-semibold text-on-deep transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <TickToSelect columns={columns} value={tickTo} onChange={setTickTo} />
      <p className="text-xs text-ink/50">New columns go just before Completed. Drag them in Board order to reorder (on a phone, use the arrows).</p>
    </form>
  );
}

/** Which column ticking a task sends it to: any column but the first. */
function TickColumnPicker({ columns, value }: { columns: BoardColumn[]; value: string }) {
  const id = useId();
  const choices = columns.filter((c) => c.id !== TODO_COLUMN);
  return (
    <div className="flex items-start gap-4 p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
        <CircleCheck className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p id={id} className="font-semibold">
          When a task is ticked
        </p>
        <p className="mt-0.5 text-sm text-ink/60">
          Ticking a task&rsquo;s circle moves it here, unless its column sends ticked tasks somewhere else (set on
          each column above). Tasks here show as ticked; unticking sends them back to {columns[0]?.label ?? "Todo"}.
        </p>
        <div role="radiogroup" aria-labelledby={id} className="mt-3 flex flex-wrap gap-2">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={value === c.id}
              onClick={() => columnActions.setTickColumn(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                value === c.id ? "border-deep bg-deep text-on-deep" : "border-ink/15 text-ink/70 hover:border-ink/30 hover:text-ink"
              }`}
            >
              <span aria-hidden className={`size-2 rounded-full ${c.dot}`} />
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * "When a task here is ticked, move it to …": a dropdown of the other columns (not Todo).
 * Used when adding a column (Settings and the board's Add column dialog) and on each column in Settings.
 */
export function TickToSelect({
  columns,
  value,
  onChange,
  exclude,
  defaultLabel,
  compact = false,
}: {
  columns: BoardColumn[];
  /** The chosen column id, or "" for the board's default. */
  value: string;
  onChange: (columnId: string) => void;
  /** The column itself (a column can't send tasks to itself). */
  exclude?: string;
  /** Offer "Default (…)" as the first choice, with this column's label. */
  defaultLabel?: string;
  compact?: boolean;
}) {
  const id = useId();
  const choices = columns.filter((c) => c.id !== TODO_COLUMN && c.id !== exclude);
  return (
    <div className={compact ? "flex flex-wrap items-center gap-2 text-xs text-ink/55" : "space-y-1.5"}>
      <label htmlFor={id} className={compact ? "" : "block text-sm font-semibold"}>
        {compact ? "Ticked tasks go to" : "When a task here is ticked, move it to"}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-xl border border-ink/15 bg-surface text-ink outline-none transition-colors hover:border-ink/30 focus:border-iris ${
          compact ? "px-2 py-1 text-xs font-semibold" : "w-full px-3 py-2.5 text-sm"
        }`}
      >
        {defaultLabel !== undefined && <option value="">Default ({defaultLabel})</option>}
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ───────────────────────── Workflow ───────────────────────── */

/** Which columns a task may move to from each column. */
export function WorkflowSettings() {
  const hydrated = useHydrated();
  const columns = useBoardColumns();
  const workflow = useWorkflow();
  const switchId = useId();

  return (
    <section aria-labelledby="workflow-settings" className="gb-rise" style={{ animationDelay: "240ms" }}>
      <h2 id="workflow-settings" className="px-1 text-xs font-semibold uppercase tracking-widest text-ink/50">
        Workflow
      </h2>
      <div className={card}>
        <div className="flex items-start gap-4 p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mist text-iris">
            <GitBranch className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p id={`${switchId}-title`} className="font-semibold">
              Limit how tasks move
            </p>
            <p id={`${switchId}-desc`} className="mt-0.5 text-sm text-ink/60">
              {workflow.enabled
                ? "Tasks can only move along the paths you allow below, by dragging, the Status picker, or ticking."
                : "Off: tasks can move between any columns. Turn it on to choose which moves are allowed."}
            </p>
          </div>
          {hydrated ? (
            <button
              type="button"
              role="switch"
              aria-checked={workflow.enabled}
              aria-labelledby={`${switchId}-title`}
              aria-describedby={`${switchId}-desc`}
              onClick={() => columnActions.setWorkflowEnabled(!workflow.enabled)}
              className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${
                workflow.enabled ? "bg-success" : "bg-ink/20"
              }`}
            >
              <span
                aria-hidden
                className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  workflow.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          ) : (
            <span className="mt-1 h-7 w-12 shrink-0 animate-pulse rounded-full bg-ink/10" />
          )}
        </div>

        {hydrated && workflow.enabled && (
          <ul aria-label="Allowed moves" className="divide-y divide-ink/10">
            {columns.map((from) => {
              const targets = columns.filter((c) => c.id !== from.id);
              const allowed = targets.filter((to) => canMove(from.id, to.id, workflow));
              return (
                <li key={from.id} className="p-5">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="text-ink/55">From</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <span aria-hidden className={`size-2.5 rounded-full ${from.dot}`} />
                      {from.label}
                    </span>
                    <span className="text-ink/55">
                      {allowed.length === 0 ? "tasks can't move anywhere" : "tasks can move to"}
                    </span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Moves from ${from.label}`}>
                    {targets.map((to) => {
                      const on = canMove(from.id, to.id, workflow);
                      return (
                        <button
                          key={to.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => columnActions.setMove(from.id, to.id, !on)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                            on
                              ? "border-deep bg-deep text-on-deep"
                              : "border-ink/15 text-ink/45 line-through decoration-ink/30 hover:border-ink/30 hover:text-ink/70"
                          }`}
                        >
                          <span aria-hidden className={`size-2 rounded-full ${to.dot} ${on ? "" : "opacity-50"}`} />
                          {to.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {hydrated && workflow.enabled && (
        <p className="mt-3 px-1 text-sm text-ink/50">
          Ticking a task is a move to Completed, and unticking is a move back to {columns[0]?.label ?? "Todo"}, so they
          follow these rules too.
        </p>
      )}
    </section>
  );
}
