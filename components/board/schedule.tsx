"use client";

import { useState, type CSSProperties } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronDown, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import type { Schedule } from "@/lib/tasks";

/* ───────────────────────── Draft helpers ───────────────────────── */

/** A start or end while it's being edited: date and time are set separately. */
export type DateTimeDraft = { date?: string; time?: string };

export const toDraft = (value?: string): DateTimeDraft =>
  value ? { date: value.slice(0, 10), time: value.slice(11, 16) } : {};

const fromDraft = (d: DateTimeDraft) => (d.date && d.time ? `${d.date}T${d.time}` : undefined);
const isEmpty = (d: DateTimeDraft) => !d.date && !d.time;

/** Why the drafts can't be saved yet, or null if they're complete or both empty. */
export function scheduleError(start: DateTimeDraft, end: DateTimeDraft): string | null {
  if (isEmpty(start) && isEmpty(end)) return null;
  const missing: string[] = [];
  if (!start.date) missing.push("start date");
  if (!start.time) missing.push("start time");
  if (!end.date) missing.push("end date");
  if (!end.time) missing.push("end time");
  if (missing.length) {
    const list =
      missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
    return `Add the ${list}.`;
  }
  if (fromDraft(end)! <= fromDraft(start)!) return "The end must be after the start.";
  return null;
}

/** The schedule the drafts describe: a Schedule, null for none, or "invalid". */
export function draftsToSchedule(start: DateTimeDraft, end: DateTimeDraft): Schedule | null | "invalid" {
  if (isEmpty(start) && isEmpty(end)) return null;
  if (scheduleError(start, end)) return "invalid";
  return { start: fromDraft(start)!, end: fromDraft(end)! };
}

/* ───────────────────────── Formatting ───────────────────────── */

function parseLocal(value: string) {
  const [d, t] = value.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return new Date(y, m - 1, day, h, min);
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** "Mon 10 Nov · 09:00 – 17:00", or "Mon 10 Nov, 09:00 → Wed 12 Nov, 17:00". */
export function formatSchedule({ start, end }: Schedule) {
  const s = parseLocal(start);
  const e = parseLocal(end);
  return start.slice(0, 10) === end.slice(0, 10)
    ? `${fmtDay(s)} · ${fmtTime(s)} – ${fmtTime(e)}`
    : `${fmtDay(s)}, ${fmtTime(s)} → ${fmtDay(e)}, ${fmtTime(e)}`;
}

/** Status of a scheduled task right now, for colouring its badge. Call in the browser only. */
export function scheduleStatus({ start, end }: Schedule, done: boolean) {
  if (done) return { label: null, cls: "bg-forest/5 text-forest/50" };
  const now = new Date();
  if (parseLocal(end) < now) return { label: "Overdue", cls: "bg-coral text-white" };
  if (parseLocal(start) <= now) return { label: "In progress", cls: "bg-leaf text-white" };
  if (start.slice(0, 10) === dateKey(now)) return { label: "Today", cls: "bg-sunny text-forest" };
  return { label: null, cls: "bg-forest/5 text-forest/70" };
}

/* ───────────────────────── Fields ───────────────────────── */

// Re-theme the shadcn Calendar (neutral tokens) to Greenboard colours.
const CALENDAR_THEME = {
  "--background": "#ffffff",
  "--foreground": "#07352a",
  "--primary": "#07352a",
  "--primary-foreground": "#c8f251",
  "--muted": "#e7f9e3",
  "--muted-foreground": "rgb(7 53 42 / 0.5)",
  "--ring": "#17b35a",
} as CSSProperties;

function DateTimeField({
  label,
  name,
  value,
  onChange,
  invalid,
}: {
  /** Visible label, e.g. "Starts on". */
  label: string;
  /** Short name for screen readers, e.g. "Start" → "Start date", "Start time". */
  name: string;
  value: DateTimeDraft;
  onChange: (next: DateTimeDraft) => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value.date ? parseLocal(`${value.date}T00:00`) : undefined;
  const dateText = selected ? fmtDay(selected) : "Pick a date";
  const ring = invalid ? "border-coral/60" : "border-forest/10";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-forest/50">{label}</span>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          aria-label={`${name} date`}
          className={`inline-flex min-w-36 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium transition-colors hover:border-leaf focus-visible:border-leaf focus-visible:outline-none ${ring} ${
            value.date ? "text-forest" : "text-forest/40"
          }`}
        >
          <CalendarDays className="size-4 text-forest/50" />
          <span className="flex-1 text-left">{dateText}</span>
          <ChevronDown className="size-3.5 text-forest/40" />
        </Popover.Trigger>
        <Popover.Portal>
          {/* Above the task details drawer (z-50). */}
          <Popover.Positioner sideOffset={8} align="start" className="z-[70]">
            <Popover.Popup
              style={CALENDAR_THEME}
              className="origin-(--transform-origin) rounded-2xl border border-forest/10 bg-white p-2 shadow-[0_20px_50px_-15px_rgb(7_53_42/0.4)] outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
            >
              <Calendar
                mode="single"
                selected={selected}
                defaultMonth={selected}
                onSelect={(d) => {
                  onChange({ ...value, date: d ? dateKey(d) : undefined });
                  if (d) setOpen(false);
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <label
        className={`inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium focus-within:border-leaf ${ring}`}
      >
        <Clock className="size-4 text-forest/50" />
        <span className="sr-only">{name} time</span>
        <input
          type="time"
          required
          value={value.time ?? ""}
          onChange={(e) => onChange({ ...value, time: e.target.value || undefined })}
          className={`bg-transparent focus:outline-none ${value.time ? "text-forest" : "text-forest/40"}`}
        />
      </label>
    </div>
  );
}

/** Start + end pickers. Both need a date and a time; errors show once anything is filled in. */
export function ScheduleFields({
  start,
  end,
  onChange,
}: {
  start: DateTimeDraft;
  end: DateTimeDraft;
  onChange: (start: DateTimeDraft, end: DateTimeDraft) => void;
}) {
  const error = scheduleError(start, end);
  const startIncomplete = !!error && (!start.date || !start.time);
  const endIncomplete = !!error && (!end.date || !end.time || error.startsWith("The end"));

  return (
    <div className="space-y-2">
      <DateTimeField label="Starts on" name="Start" value={start} invalid={startIncomplete} onChange={(s) => onChange(s, end)} />
      <DateTimeField label="Ends on" name="End" value={end} invalid={endIncomplete} onChange={(e) => onChange(start, e)} />
      {error && (
        <p role="alert" className="pl-[5.5rem] text-xs font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
