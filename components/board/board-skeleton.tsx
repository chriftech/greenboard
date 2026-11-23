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

/** One task card: tick circle, title and tag. */
function TaskCardSkeleton({ title }: { title: string }) {
  return (
    <div className="flex h-[78px] items-start gap-2.5 rounded-xl border border-ink/10 bg-white p-3 dark:bg-surface">
      <Skeleton className="size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className="h-3.5 max-w-full" style={{ width: title }} />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
    </div>
  );
}

const TITLES = [
  ["70%", "52%", "62%"],
  ["58%", "74%"],
  ["64%", "48%", "56%"],
];

/** The board: Todo, Pending and Completed columns side by side (phones see the first, and the next peeking in). */
export function TaskBoardSkeleton() {
  return (
    <SkeletonRegion label="Loading your tasks…">
      {/* The filter bar: filters on the left, Import and Export on the right. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="hidden h-3 w-14 sm:block" />
        <Skeleton className="h-8 w-20 rounded-xl" />
        <Skeleton className="h-8 w-24 rounded-xl" />
        <Skeleton className="h-8 w-24 rounded-xl" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>
      <div className="-mx-4 flex items-start gap-3 overflow-hidden px-4">
        {TITLES.map((titles, c) => (
          <div key={c} className="w-[min(18rem,calc(100vw-4rem))] shrink-0 space-y-2 rounded-2xl bg-ink/[0.04] p-2">
            <div className="flex items-center gap-2 pb-1">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-3 w-4" />
            </div>
            {titles.map((title, i) => (
              <TaskCardSkeleton key={i} title={title} />
            ))}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** The board page beside the sidebar (the workspace layout keeps the real sidebar on screen), shown while it opens. */
export function BoardPageSkeleton() {
  return (
    <div className="relative min-w-0 flex-1 overflow-x-clip">
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 pt-6 lg:justify-end">
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
        <div className="mx-auto max-w-7xl px-4">
          <GreetingSkeleton />
        </div>
        <section className="mx-auto mt-10 max-w-7xl px-4">
          <TaskBoardSkeleton />
        </section>
      </main>
    </div>
  );
}
