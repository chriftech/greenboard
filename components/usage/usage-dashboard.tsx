"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarClock,
  CircleCheck,
  CircleDashed,
  Download,
  FileJson,
  ListChecks,
  ListTodo,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { getServerTasks, getTasks, subscribeTasks } from "@/lib/tasks";
import { useBoardColumns } from "@/lib/columns";
import { useTags } from "@/lib/tags";
import { NEXT_PLAN, PLAN_NAMES, usePlan } from "@/lib/plan";
import { computeUsage, downloadUsageCsv, downloadUsageJson, ACTIVITY_DAYS, type Breakdown, type Usage } from "@/lib/usage";
import { PremiumBadge } from "@/components/pricing/premium-badge";

const card =
  "rounded-[24px] border border-ink/10 bg-surface p-5 shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)] sm:p-6";

/** Everything on the Usage page: totals, plan limits, recent activity and breakdowns, with export. */
export function UsageDashboard() {
  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const columns = useBoardColumns();
  const tags = useTags();
  const plan = usePlan();
  // Fixed when the page opens, so the numbers don't shift while reading them.
  const [now] = useState(() => Date.now());

  const usage = useMemo(
    () => (tasks ? computeUsage({ tasks, columns, tags, plan, now }) : null),
    [tasks, columns, tags, plan, now],
  );

  if (!usage) return <UsageSkeleton />;
  const t = usage.totals;

  return (
    <div className="mt-8 space-y-6">
      {/* Plan and export */}
      <div className="gb-rise flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink/60">
          {usage.since ? (
            <>
              Using Greenboard since{" "}
              <span className="font-semibold text-ink">
                {new Date(usage.since).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
              </span>{" "}
              · {usage.plan.name} plan
            </>
          ) : (
            <>No tasks yet · {usage.plan.name} plan</>
          )}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => downloadUsageCsv(usage)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-deep px-4 py-2.5 text-sm font-semibold text-on-deep transition-transform hover:-translate-y-0.5"
          >
            <Download className="size-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => downloadUsageJson(usage)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/15 bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-ink/30"
          >
            <FileJson className="size-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Headline numbers */}
      <section aria-label="Totals" className="gb-rise grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Stat icon={<ListTodo className="size-4" />} label="Tasks" value={t.tasks} note={`${t.open} open, on the board`} />
        <Stat
          icon={<CircleCheck className="size-4" />}
          label="Completed"
          value={t.completed}
          note={`${t.completionRate}% of tasks on the board`}
        />
        <Stat
          icon={<CalendarClock className="size-4" />}
          label="Scheduled"
          value={t.scheduled}
          note={t.overdue ? `${t.overdue} overdue` : "None overdue"}
          warn={t.overdue > 0}
        />
        <Stat icon={<Archive className="size-4" />} label="In Trash" value={t.inTrash} note={`Kept for ${usage.limits.trashDays} days`} />
        <Stat
          icon={<ListChecks className="size-4" />}
          label="Subtasks done"
          value={t.subtasksDone}
          note={`of ${t.subtasks} subtasks`}
        />
        <Stat icon={<Sparkles className="size-4" />} label="New this week" value={t.createdThisWeek} note="Last 7 days" />
        <Stat icon={<CircleCheck className="size-4" />} label="Done this week" value={t.completedThisWeek} note="Last 7 days" />
        <Stat
          icon={<CircleDashed className="size-4" />}
          label="Completion rate"
          value={`${t.completionRate}%`}
          note={`${t.completed} of ${t.tasks} tasks`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ActivityChart usage={usage} />
        <PlanUsage usage={usage} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <BreakdownCard title="Tasks by column" items={usage.byColumn} />
        <BreakdownCard title="Tasks by tag" items={usage.byTag} dots />
        <BreakdownCard title="Tasks by priority" items={usage.byPriority} dots />
      </div>

      <p className="px-1 text-sm text-ink/50">
        Usage is worked out from the tasks saved in this browser. Exports include every number on this page.
      </p>
    </div>
  );
}

function Stat({ icon, label, value, note, warn = false }: { icon: ReactNode; label: string; value: number | string; note: string; warn?: boolean }) {
  return (
    <div className="rounded-[20px] border border-ink/10 bg-surface p-4 sm:p-5">
      <p className="flex items-start gap-2 text-xs font-semibold uppercase tracking-wider text-ink/50">
        <span className="shrink-0 text-iris">{icon}</span>
        <span className="min-w-0">{label}</span>
      </p>
      <p className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">{value}</p>
      <p className={`mt-1 flex items-center gap-1 text-sm ${warn ? "text-coral" : "text-ink/55"}`}>
        {warn && <TriangleAlert aria-hidden className="size-3.5 shrink-0" />}
        {note}
      </p>
    </div>
  );
}

/** Tasks completed per day over the last two weeks: one bar per day, with the created count on hover. */
function ActivityChart({ usage }: { usage: Usage }) {
  const days = usage.activity;
  const max = Math.max(1, ...days.map((d) => d.completed));
  const total = days.reduce((n, d) => n + d.completed, 0);
  const label = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T00:00`).toLocaleDateString(undefined, opts);
  // The day whose numbers are showing: hovered with a mouse, or tapped on a touch screen.
  const [active, setActive] = useState<string | null>(null);

  return (
    <section aria-labelledby="activity-title" className={`${card} gb-rise`} style={{ animationDelay: "120ms" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="activity-title" className="font-display text-lg font-bold">
          Completed per day
        </h2>
        <p className="text-sm text-ink/55">
          {total} in the last {ACTIVITY_DAYS} days
        </p>
      </div>

      <div className="relative mt-6 h-44" aria-hidden>
        {/* Recessive guides: the top value and the baseline. */}
        <div className="absolute left-6 right-0 top-0 border-t border-dashed border-ink/10" />
        <span className="absolute -top-2 left-0 text-[11px] leading-none tabular-nums text-ink/40">{max}</span>
        <span className="absolute -bottom-1.5 left-0 text-[11px] leading-none tabular-nums text-ink/40">0</span>
        <div className="absolute bottom-0 left-6 right-0 border-t border-ink/15" />

        <div className="absolute inset-y-0 left-6 right-0 flex items-end gap-[2px] sm:gap-1">
          {days.map((d, i) => (
            // The hit area is the whole column, wider and taller than the bar.
            <div
              key={d.day}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(d.day)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
              // Touch has no hover: a tap shows the day, and tapping it again hides it.
              onPointerUp={(e) => e.pointerType !== "mouse" && setActive((a) => (a === d.day ? null : d.day))}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
            >
              <div
                className={`w-full max-w-7 rounded-t-[4px] bg-iris transition-opacity ${active === d.day ? "opacity-80" : ""}`}
                style={{ height: d.completed ? `${(d.completed / max) * 100}%` : "2px", opacity: d.completed ? undefined : 0.25 }}
              />
              {/* Kept inside the card: anchored left near the start, right near the end. */}
              <div
                className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-xl bg-ink px-3 py-2 text-xs text-paper shadow-lg ${
                  active === d.day ? "block" : "hidden"
                } ${i < 3 ? "left-0" : i > days.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
              >
                <p className="font-semibold">{label(d.day, { weekday: "short", day: "numeric", month: "short" })}</p>
                <p className="mt-0.5 tabular-nums">{d.completed} completed</p>
                <p className="tabular-nums opacity-70">{d.created} created</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-2 flex justify-between pl-6 text-[11px] text-ink/45">
        <span>{label(days[0].day, { day: "numeric", month: "short" })}</span>
        <span>Today</span>
      </div>

      {/* The same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>Tasks created and completed per day, last {ACTIVITY_DAYS} days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Completed</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{label(d.day, { weekday: "long", day: "numeric", month: "long" })}</th>
              <td>{d.completed}</td>
              <td>{d.created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** How much of the plan's limits is in use. */
function PlanUsage({ usage }: { usage: Usage }) {
  const plan = usePlan();
  const next = NEXT_PLAN[plan];
  const { columns, tags } = usage.limits;

  return (
    <section aria-labelledby="plan-title" className={`${card} gb-rise`} style={{ animationDelay: "160ms" }}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="plan-title" className="font-display text-lg font-bold">
          Plan usage
        </h2>
        <span className="rounded-full bg-ink/8 px-2.5 py-0.5 text-xs font-semibold text-ink/70">{usage.plan.name}</span>
      </div>

      <div className="mt-5 space-y-5">
        <Meter label="Columns of your own" used={columns.used} limit={columns.limit} />
        <Meter label="Tags you created" used={tags.used} limit={tags.limit} />
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Days kept in Trash</span>
          <span className="tabular-nums text-ink/60">{usage.limits.trashDays}</span>
        </div>
      </div>

      {next && (
        <Link
          href="/pricing"
          className="mt-6 flex items-center gap-2 rounded-2xl border border-sunny/40 bg-sunny/10 px-4 py-3 text-sm font-semibold transition-colors hover:border-sunny"
        >
          <PremiumBadge plan={next} iconOnly />
          <span className="flex-1">See what {PLAN_NAMES[next]} adds</span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const finite = Number.isFinite(limit);
  const pct = finite ? Math.min(100, Math.round((used / Math.max(1, limit)) * 100)) : 0;
  const full = finite && used >= limit;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-ink/60">
          {used} {finite ? `of ${limit}` : "· unlimited"}
        </span>
      </div>
      {finite && (
        <div
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="mt-2 h-2 overflow-hidden rounded-full bg-mist"
        >
          <div className={`h-full rounded-full ${full ? "bg-sunny" : "bg-iris"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {full && <p className="mt-1.5 text-xs text-ink/55">Limit reached on this plan.</p>}
    </div>
  );
}

/** A ranked list: label, count, and a bar scaled to the largest count. */
function BreakdownCard({ title, items, dots = false }: { title: string; items: Breakdown[]; dots?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const id = `breakdown-${title.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <section aria-labelledby={id} className={`${card} gb-rise`} style={{ animationDelay: "200ms" }}>
      <h2 id={id} className="font-display text-lg font-bold">
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} title={`${item.label}: ${item.count}`}>
            <div className="flex items-center gap-2 text-sm">
              {dots && (
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full bg-ink/40"
                  style={item.color ? { backgroundColor: item.color } : undefined}
                />
              )}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="tabular-nums font-semibold">{item.count}</span>
            </div>
            <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist">
              <div className="h-full rounded-full bg-iris" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UsageSkeleton() {
  return (
    <div aria-hidden className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-[20px] bg-ink/5" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-72 animate-pulse rounded-[24px] bg-ink/5" />
        <div className="h-72 animate-pulse rounded-[24px] bg-ink/5" />
      </div>
    </div>
  );
}
