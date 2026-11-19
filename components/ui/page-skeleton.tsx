import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/landing/logo";
import { Skeleton } from "./skeleton";

/**
 * The frame the Settings and Help pages share (backdrop, header, dark intro card),
 * with placeholders where their content goes. Shown while one of them opens.
 */
export function PageSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative flex-1 overflow-x-clip text-ink">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="gb-grid-bg absolute inset-0" />
        <div className="gb-blob absolute -top-48 left-[20%] size-[520px] rounded-full bg-peach/35 blur-3xl dark:bg-peach/10" />
        <div
          className="gb-blob absolute -right-40 top-1/3 size-[440px] rounded-full bg-skyblue/20 blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 pt-6 lg:justify-end">
        <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden" aria-label="Greenboard home">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
        </Link>
        <div aria-hidden className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-xl sm:w-20 lg:hidden" />
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl sm:w-32" />
        </div>
      </header>

      <main role="status" aria-busy="true" className="relative mx-auto max-w-7xl px-4 pb-24 pt-8">
        <span className="sr-only">{label}</span>
        <div className="relative overflow-hidden rounded-[28px] bg-deep p-6 shadow-[0_30px_80px_-30px_rgb(46_51_73/0.7)] sm:p-8">
          <Skeleton className="size-12 rounded-2xl bg-white/15" />
          <Skeleton className="mt-5 h-8 w-48 bg-white/15 sm:h-10 sm:w-64" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full bg-white/10" />
        </div>
        <div className="mt-10 space-y-10">{children}</div>
      </main>
    </div>
  );
}
