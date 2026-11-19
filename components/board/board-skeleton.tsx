import Link from "next/link";
import { Logo } from "@/components/landing/logo";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/*
 * Placeholders for the board while it loads. Each one has the same size and
 * shape as the real thing, so nothing jumps when the board arrives.
 * They're rendered before the screen width is known, so they work at any width.
 */

/** The "Good morning" card. */
export function GreetingSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-deep p-5 shadow-[0_30px_80px_-30px_rgb(46_51_73/0.7)] sm:p-8">
      <div className="flex items-center justify-between gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-36 bg-white/15" />
          <Skeleton className="mt-3 h-7 w-52 max-w-full bg-white/15 sm:h-10 sm:w-72" />
          <Skeleton className="mt-3 h-4 w-64 max-w-full bg-white/10" />
        </div>
        <Skeleton className="size-20 shrink-0 border-[8px] border-white/10 bg-transparent sm:size-28 sm:border-[12px]" />
      </div>
    </div>
  );
}

/** The new-task form: tag chips, the task box, and the row of extras. */
export function ComposerSkeleton() {
  return (
    <div className="mt-6 first:mt-0 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)] sm:p-5">
      <div className="flex flex-wrap gap-1.5 border-b border-ink/5 pb-4">
        {[20, 16, 20, 16, 18, 16].map((w, i) => (
          <Skeleton key={i} className="h-8" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-2xl" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="hidden h-8 w-20 sm:block" />
          <Skeleton className="hidden h-8 w-24 sm:block" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  );
}

/** One task card: tick circle, title and tag. */
function TaskCardSkeleton({ title }: { title: string }) {
  return (
    <div className="flex h-[68px] items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4">
      <Skeleton className="size-6 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 max-w-full" style={{ width: title }} />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

const TITLES = [
  ["70%", "52%", "62%"],
  ["58%", "74%", "46%"],
];

/** The Pending and Completed columns (on phones, just the list). */
export function TaskBoardSkeleton() {
  return (
    <SkeletonRegion label="Loading your tasks…" className="grid divide-ink/15 border-ink/15 md:grid-cols-2 md:divide-x md:border-t">
      {TITLES.map((titles, c) => (
        <div key={c} className={`space-y-3 md:px-5 md:pt-4 md:first:pl-0 md:last:pr-0 ${c ? "hidden md:block" : ""}`}>
          <div className="flex items-center gap-2 pb-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-6" />
          </div>
          {titles.map((title, i) => (
            <TaskCardSkeleton key={i} title={title} />
          ))}
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** The sidebar (from lg up): logo, search, the workspace list, tags and the account. */
function SidebarSkeleton() {
  const row = (w: string, i: number) => (
    <div key={i} className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="size-4 rounded-md" />
      <Skeleton className="h-3" style={{ width: w }} />
    </div>
  );
  return (
    <div
      aria-hidden
      className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-ink/10 bg-surface/75 lg:flex"
    >
      <div className="flex items-center gap-2 px-4 pb-3 pt-5">
        <Logo />
        <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
      </div>
      <div className="px-3">
        <Skeleton className="h-9 w-full rounded-xl" />
        <Skeleton className="mb-1 ml-3 mt-6 h-2.5 w-20" />
        {["50%", "35%", "45%", "50%", "30%"].map(row)}
        <Skeleton className="mb-1 ml-3 mt-6 h-2.5 w-12" />
        {["40%", "30%", "45%", "35%"].map(row)}
      </div>
      <div className="mt-auto px-3 pb-4">
        {["40%", "55%"].map(row)}
        <div className="mt-2 flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-8 shrink-0" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

/** The whole board page, shown while it opens. */
export function BoardPageSkeleton() {
  return (
    <div className="flex min-h-full flex-1 bg-paper text-ink">
      <SidebarSkeleton />
      <div className="relative min-w-0 flex-1 overflow-x-clip">
        <header className="relative mx-auto flex max-w-5xl items-center justify-between px-4 pt-6 lg:justify-end">
          <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
            <Logo />
            <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
          </Link>
          <div aria-hidden className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-xl sm:w-20 lg:hidden" />
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="mx-1 size-9" />
          </div>
        </header>
        <main className="relative pb-24 pt-8">
          <div className="mx-auto max-w-5xl px-4">
            <GreetingSkeleton />
            <ComposerSkeleton />
          </div>
          <section className="mx-auto mt-10 max-w-5xl px-4">
            <TaskBoardSkeleton />
          </section>
        </main>
      </div>
    </div>
  );
}
