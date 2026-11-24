"use client";

import { useId, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Columns3, Plus, X } from "lucide-react";
import { MAX_COLUMN_LABEL, MAX_EXTRA_COLUMNS, columnActions, useBoardColumns, useTickColumn, type ColumnColor } from "@/lib/columns";
import { ColorPicker, TickToSelect } from "@/components/settings/columns-settings";

/**
 * "Add column" on the board: a button that opens a small dialog (name + colour).
 * The column goes just before Completed, like one added in Settings.
 */
export function AddColumnButton({ onAdded }: { /** Called with the new column's id, to show it. */ onAdded?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const columns = useBoardColumns();
  // Todo and Completed don't count towards the limit.
  const full = columns.length - 2 >= MAX_EXTRA_COLUMNS;
  const hint = full ? `You can add up to ${MAX_EXTRA_COLUMNS} columns. Delete one in Settings to add another.` : "Add a column";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        disabled={full}
        title={hint}
        aria-label="Add a column"
        // Matches Import beside it; icon only on phones.
        className="inline-flex items-center gap-1.5 rounded-xl border border-ink/15 bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink transition-colors enabled:hover:border-ink/30 disabled:opacity-40 sm:px-3.5"
      >
        <Columns3 className="size-4" />
        <span className="hidden sm:inline">Add column</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-ink/10 bg-surface p-6 text-ink shadow-[0_30px_80px_-20px_rgb(46_51_73/0.5)] outline-none transition-all duration-200 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0">
          {/* Remount each time so it opens empty. */}
          {open && (
            <AddColumnForm
              onDone={(id) => {
                setOpen(false);
                onAdded?.(id);
              }}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddColumnForm({ onDone }: { onDone: (id: string) => void }) {
  const id = useId();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<ColumnColor>("sky");
  const columns = useBoardColumns();
  // Starts on the board's default (Completed unless changed in Settings).
  const [tickTo, setTickTo] = useState(useTickColumn());

  function submit(e: FormEvent) {
    e.preventDefault();
    const added = columnActions.add(label, color, { tickTo });
    if (added) onDone(added);
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-iris/10 text-iris">
          <Columns3 className="size-6" />
        </div>
        <Dialog.Close aria-label="Close" className="rounded-xl p-2 text-ink/50 transition-colors hover:bg-paper hover:text-ink">
          <X className="size-4" />
        </Dialog.Close>
      </div>
      <Dialog.Title className="mt-4 font-display text-xl font-bold">Add a column</Dialog.Title>
      <Dialog.Description className="mt-1.5 text-[15px] leading-relaxed text-ink/65">
        It goes just before Completed. Rename, reorder or delete columns in Settings.
      </Dialog.Description>

      <label htmlFor={id} className="mt-5 block text-sm font-semibold">
        Name
      </label>
      <input
        id={id}
        autoFocus
        value={label}
        maxLength={MAX_COLUMN_LABEL}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. In review"
        className="mt-1.5 w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink/35 focus:border-iris"
      />
      <p className="mt-4 text-sm font-semibold">Colour</p>
      <ColorPicker value={color} onChange={setColor} className="mt-1.5" />
      <div className="mt-4">
        <TickToSelect columns={columns} value={tickTo} onChange={setTickTo} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Dialog.Close className="rounded-xl border border-ink/15 bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-paper">
          Cancel
        </Dialog.Close>
        <button
          type="submit"
          disabled={!label.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-deep px-4 py-2.5 text-sm font-semibold text-on-deep transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
        >
          <Plus className="size-4" />
          Add column
        </button>
      </div>
    </form>
  );
}
