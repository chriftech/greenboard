"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Palette, Trash2, X } from "lucide-react";
import { MAX_TAG_LABEL, TAG_COLORS, tagActions, tagLabelError, type CustomTag } from "@/lib/tags";
import { TagChip } from "./tag-chip";

/** Create a custom tag (tag = null) or edit/delete an existing one. */
export function TagEditor({
  open,
  onOpenChange,
  tag,
  onCreated,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: CustomTag | null;
  onCreated?: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-ink/10 bg-surface p-6 text-ink shadow-[0_30px_80px_-20px_rgb(46_51_73/0.5)] outline-none transition-all duration-200 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0">
          {/* Remount the form each time so it starts from this tag's values. */}
          {open && (
            <EditorForm
              key={tag?.id ?? "new"}
              tag={tag}
              onDone={() => onOpenChange(false)}
              onCreated={onCreated}
              onDeleted={onDeleted}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditorForm({
  tag,
  onDone,
  onCreated,
  onDeleted,
}: {
  tag: CustomTag | null;
  onDone: () => void;
  onCreated?: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const [label, setLabel] = useState(tag?.label ?? "");
  const [color, setColor] = useState(tag?.color ?? TAG_COLORS[0]);
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const error = tagLabelError(label, tag?.id);
  const isPreset = TAG_COLORS.includes(color);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    if (tag) {
      tagActions.update(tag.id, { label, color });
    } else {
      const id = tagActions.add(label, color);
      if (id) onCreated?.(id);
    }
    onDone();
  }

  function remove() {
    if (!tag) return;
    if (!confirmDelete) return setConfirmDelete(true);
    tagActions.remove(tag.id);
    onDeleted?.(tag.id);
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Dialog.Title className="font-display text-xl font-bold">{tag ? "Edit tag" : "New tag"}</Dialog.Title>
          <Dialog.Description className="mt-0.5 text-sm text-ink/55">
            {tag ? "Rename it or pick a new colour." : "Name it and pick a colour."}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/50 transition-colors hover:bg-mist hover:text-ink"
        >
          <X className="size-4" />
        </Dialog.Close>
      </div>

      <label className="mt-5 block">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink/50">Name</span>
        <input
          autoFocus
          value={label}
          maxLength={MAX_TAG_LABEL}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label && setTouched(true)}
          placeholder="e.g. Errands"
          aria-invalid={touched && !!error}
          className={`mt-2 w-full rounded-xl border bg-paper px-3 py-2.5 text-sm font-medium placeholder:text-ink/35 focus:outline-none ${
            touched && error ? "border-coral" : "border-ink/10 focus:border-iris"
          }`}
        />
      </label>
      {touched && error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-coral">
          {error}
        </p>
      )}

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-widest text-ink/50">Colour</legend>
        <div role="radiogroup" aria-label="Colour" className="mt-2 flex flex-wrap gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`grid size-8 place-items-center rounded-full transition-transform hover:scale-110 ${
                color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
              }`}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
          {/* Any other colour via the browser's colour picker */}
          <label
            title="Pick any colour"
            className={`relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full transition-transform hover:scale-110 ${
              !isPreset ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
            }`}
            style={{
              background: isPreset
                ? "conic-gradient(#f43f5e, #f59e0b, #06b6d4, #6366f1, #ec4899, #f43f5e)"
                : color,
            }}
          >
            <span className="sr-only">Custom colour</span>
            {isPreset ? (
              <Palette className="size-4 text-white drop-shadow" />
            ) : (
              <Check className="size-4 text-white" strokeWidth={3} />
            )}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </fieldset>

      <div className="mt-5 flex items-center gap-2 text-xs text-ink/50">
        Preview
        <TagChip tag={{ id: "preview", label: label.trim() || "Tag", color, custom: true }} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        {tag ? (
          <button
            type="button"
            onClick={remove}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              confirmDelete ? "bg-coral text-white" : "text-coral hover:bg-coral/10"
            }`}
          >
            <Trash2 className="size-4" />
            {confirmDelete ? "Delete for good?" : "Delete"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Dialog.Close className="rounded-xl border border-ink/15 bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-paper">
            Cancel
          </Dialog.Close>
          <button
            type="submit"
            disabled={touched && !!error}
            className="rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
          >
            {tag ? "Save" : "Create tag"}
          </button>
        </div>
      </div>
      {confirmDelete && (
        <p className="mt-3 text-xs text-ink/55">Tasks with this tag will move to Default.</p>
      )}
    </form>
  );
}
