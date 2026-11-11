"use client";

import { useState, type FormEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown, Flag, Plus, UserRound, X } from "lucide-react";
import { PRIORITIES, type PriorityId } from "@/lib/tasks";
import { MAX_PERSON_NAME, ME, avatarColor, findPerson, initials, peopleActions, usePeople, type Person } from "@/lib/people";
import { customChipStyle } from "./tag-chip";

/* ───────────────────────── Shared bits ───────────────────────── */

type Variant = "pill" | "field";

/** Trigger styles: "pill" in the new-task form, "field" in the task editor. */
function triggerClass(variant: Variant, active: boolean) {
  return variant === "pill"
    ? `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "border-ink/20 text-ink" : "border-ink/10 text-ink/60 hover:border-ink/25 hover:text-ink"
      }`
    : "inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-iris focus-visible:border-iris focus-visible:outline-none";
}

function Panel({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Popover.Portal>
      {/* Above the task drawer/modal (z-50) and its confirmation dialog (z-60). */}
      <Popover.Positioner sideOffset={8} align="start" className="z-[70]">
        <Popover.Popup
          aria-label={label}
          className="w-60 origin-(--transform-origin) rounded-2xl border border-ink/10 bg-surface p-1.5 text-ink shadow-[0_20px_50px_-15px_rgb(46_51_73/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
        >
          {children}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}

function OptionRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors ${
        selected ? "bg-mist text-ink" : "text-ink/75 hover:bg-mist hover:text-ink"
      }`}
    >
      {children}
      <Check className={`ml-auto size-4 shrink-0 text-iris ${selected ? "" : "invisible"}`} strokeWidth={3} />
    </button>
  );
}

/* ───────────────────────── Priority ───────────────────────── */

const priorityOf = (id?: PriorityId) => PRIORITIES.find((p) => p.id === id);

export function PriorityFlag({ priority, className = "size-3.5" }: { priority?: PriorityId; className?: string }) {
  const p = priorityOf(priority);
  return (
    <Flag
      aria-hidden
      className={`shrink-0 ${className}`}
      style={p ? { color: p.color, fill: p.color } : undefined}
      strokeWidth={2.5}
    />
  );
}

/** Small chip for task rows. Renders nothing for tasks without a priority. */
export function PriorityChip({ priority }: { priority?: PriorityId }) {
  const p = priorityOf(priority);
  if (!p) return null;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={customChipStyle(p.color)}
      title={`${p.label} priority`}
    >
      <PriorityFlag priority={p.id} className="size-3" />
      {p.label}
    </span>
  );
}

export function PriorityPicker({
  value,
  onChange,
  variant,
}: {
  value?: PriorityId;
  onChange: (value: PriorityId | undefined) => void;
  variant: Variant;
}) {
  const [open, setOpen] = useState(false);
  const p = priorityOf(value);
  const choose = (v: PriorityId | undefined) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={`Priority: ${p ? p.label : "none"}`} className={triggerClass(variant, !!p)}>
        <PriorityFlag priority={value} className={variant === "pill" ? "size-3.5" : "size-4 text-ink/50"} />
        <span>{p ? p.label : variant === "pill" ? "Priority" : "No priority"}</span>
        {variant === "field" && <ChevronDown className="size-3.5 text-ink/40" />}
      </Popover.Trigger>
      <Panel label="Choose a priority">
        <div role="listbox" aria-label="Priority">
          {PRIORITIES.map((opt) => (
            <OptionRow key={opt.id} selected={value === opt.id} onSelect={() => choose(opt.id)}>
              <PriorityFlag priority={opt.id} className="size-4" />
              {opt.label}
            </OptionRow>
          ))}
          <div className="my-1 h-px bg-ink/10" />
          <OptionRow selected={!value} onSelect={() => choose(undefined)}>
            <Flag aria-hidden className="size-4 text-ink/35" strokeWidth={2.5} />
            No priority
          </OptionRow>
        </div>
      </Panel>
    </Popover.Root>
  );
}

/* ───────────────────────── Assignee ───────────────────────── */

export function Avatar({ person, size = 22 }: { person: Person; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), backgroundColor: avatarColor(person) }}
    >
      {initials(person.name)}
    </span>
  );
}

/** Avatar for task rows, with the name as a tooltip. Renders nothing when unassigned. */
export function AssigneeBadge({ assignee }: { assignee?: string }) {
  const people = usePeople();
  const person = findPerson(people, assignee);
  if (!person) return null;
  const label = person.id === ME.id ? "Assigned to me" : `Assigned to ${person.name}`;
  return (
    <span title={label} className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <Avatar person={person} size={20} />
    </span>
  );
}

export function AssigneePicker({
  value,
  onChange,
  variant,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  variant: Variant;
}) {
  const people = usePeople();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const person = findPerson(people, value);

  const q = query.trim().toLowerCase();
  const shown = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
  const exact = people.find((p) => p.name.toLowerCase() === q);

  function choose(id: string | undefined) {
    onChange(id);
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setConfirmRemove(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // don't submit the new-task form around it
    if (!q) return;
    const id = exact ? exact.id : peopleActions.add(query);
    if (id) choose(id);
  }

  function remove(p: Person) {
    if (confirmRemove !== p.id) return setConfirmRemove(p.id);
    if (value === p.id) onChange(undefined);
    peopleActions.remove(p.id);
    setConfirmRemove(null);
  }

  const name = person ? (person.id === ME.id ? "Me" : person.name) : null;

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger aria-label={`Assignee: ${name ?? "unassigned"}`} className={triggerClass(variant, !!person)}>
        {person ? <Avatar person={person} size={variant === "pill" ? 16 : 20} /> : <UserRound className={variant === "pill" ? "size-3.5" : "size-4 text-ink/50"} />}
        <span className="max-w-32 truncate">{name ?? (variant === "pill" ? "Assignee" : "Unassigned")}</span>
        {variant === "field" && <ChevronDown className="size-3.5 text-ink/40" />}
      </Popover.Trigger>
      <Panel label="Choose an assignee">
        {/* A div with its own submit handler, since this can sit inside the new-task <form>. */}
        <div
          role="search"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(e as unknown as FormEvent);
          }}
          className="mb-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-paper px-2.5 py-1.5 focus-within:border-iris"
        >
          <UserRound className="size-4 shrink-0 text-ink/40" />
          <input
            autoFocus
            value={query}
            maxLength={MAX_PERSON_NAME}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name to find or add…"
            aria-label="Find or add a person"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-ink/40 focus:outline-none"
          />
        </div>

        <div role="listbox" aria-label="Assignee" className="max-h-60 overflow-y-auto">
          {!q && (
            <OptionRow selected={!value} onSelect={() => choose(undefined)}>
              <span className="grid size-[22px] place-items-center rounded-full border border-dashed border-ink/25">
                <UserRound className="size-3 text-ink/40" />
              </span>
              Unassigned
            </OptionRow>
          )}
          {shown.map((p) => (
            <div key={p.id} className="group/person relative">
              <OptionRow selected={value === p.id} onSelect={() => choose(p.id)}>
                <Avatar person={p} />
                <span className="min-w-0 flex-1 truncate">{p.id === ME.id ? "Me" : p.name}</span>
                {/* room for the remove button */}
                {p.id !== ME.id && <span className="w-6 shrink-0" />}
              </OptionRow>
              {p.id !== ME.id && (
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label={confirmRemove === p.id ? `Confirm removing ${p.name}` : `Remove ${p.name} from the list`}
                  title={confirmRemove === p.id ? "Click again to remove. Their tasks become unassigned." : "Remove from the list"}
                  className={`absolute right-8 top-1/2 -translate-y-1/2 rounded-lg px-1.5 py-1 text-[11px] font-semibold transition-colors ${
                    confirmRemove === p.id ? "bg-coral text-white" : "text-ink/35 hover:bg-coral/10 hover:text-coral"
                  }`}
                >
                  {confirmRemove === p.id ? "Remove?" : <X className="size-3.5" />}
                </button>
              )}
            </div>
          ))}
          {q && !exact && (
            <button
              type="button"
              onClick={(e) => submit(e as unknown as FormEvent)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-iris hover:bg-mist"
            >
              <span className="grid size-[22px] place-items-center rounded-full bg-iris/15">
                <Plus className="size-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 truncate">
                Add &ldquo;{query.trim()}&rdquo;
              </span>
            </button>
          )}
        </div>
      </Panel>
    </Popover.Root>
  );
}
