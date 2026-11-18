import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LostTask } from "@/components/not-found/lost-task";

export const metadata: Metadata = {
  title: "Page not found — Greenboard",
  description: "This page isn't on the board.",
};

/** Shown for any address that doesn't exist (Next.js sends it with a 404 status). */
export default function NotFound() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip text-ink">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="gb-grid-bg absolute inset-0" />
        <div className="gb-blob absolute -top-48 left-[12%] size-[520px] rounded-full bg-peach/35 blur-3xl dark:bg-peach/10" />
        <div
          className="gb-blob absolute -right-40 top-1/3 size-[440px] rounded-full bg-iris/15 blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Greenboard home">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 pb-16 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-10">
        <section className="gb-rise text-center md:text-left">
          {/* "404", with the 0 drawn as an empty task checkbox. */}
          <p
            aria-hidden
            className="flex items-center justify-center gap-1 font-display text-[7.5rem] font-extrabold leading-none tracking-tighter sm:text-[9.5rem] md:justify-start"
          >
            <span>4</span>
            <span className="gb-wiggle relative mx-1 inline-grid size-[0.78em] place-items-center rounded-full border-[0.11em] border-dashed border-iris/70">
              <span className="size-[0.16em] rounded-full bg-peach" />
            </span>
            <span>4</span>
          </p>

          <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            This page isn&rsquo;t on the board.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-ink/60 md:mx-0">
            The link may be old, or the page has moved. Let&rsquo;s get you back to something you can tick off.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link
              href="/board"
              className="gb-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-deep px-5 py-3 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Go to my board
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-ink/15 bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/30 sm:w-auto"
            >
              Back to home
            </Link>
          </div>

          <p className="mt-6 text-sm text-ink/55">
            Think something&rsquo;s broken?{" "}
            <Link href="/help" className="inline-flex items-center gap-1 font-semibold text-iris underline-offset-4 hover:underline">
              <LifeBuoy className="size-3.5" />
              Tell us
            </Link>
          </p>
        </section>

        <div className="gb-rise flex justify-center md:justify-end" style={{ animationDelay: "0.15s" }}>
          <LostTask />
        </div>
      </main>
    </div>
  );
}
