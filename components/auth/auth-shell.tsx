import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarClock, CircleCheckBig, Sparkles } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const PERKS = [
  { icon: CircleCheckBig, text: "Tick tasks off and watch your board come together" },
  { icon: CalendarClock, text: "Timelines, priorities and assignees on every task" },
  { icon: Sparkles, text: "Soon: your board on every device, synced to your account" },
];

/** Shared frame for the login and signup pages: brand panel on the left, form on the right. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip text-ink">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="gb-grid-bg absolute inset-0" />
        <div className="gb-blob absolute -top-48 left-[18%] size-[520px] rounded-full bg-peach/35 blur-3xl dark:bg-peach/10" />
        <div
          className="gb-blob absolute -right-40 top-1/3 size-[440px] rounded-full bg-skyblue/20 blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Greenboard home">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-surface hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            <span className="sm:hidden">Home</span>
            <span className="hidden sm:inline">Back to home</span>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 items-center px-4 pb-16 pt-8">
        <div className="gb-rise grid w-full overflow-hidden rounded-[28px] border border-ink/10 bg-surface shadow-[0_30px_80px_-35px_rgb(46_51_73/0.55)] md:grid-cols-[1fr_1.1fr]">
          {/* Brand panel: hidden on phones, where the form needs the room. */}
          <section className="relative hidden overflow-hidden bg-deep p-10 text-white md:flex md:flex-col">
            <div aria-hidden className="gb-blob absolute -right-20 -top-24 size-72 rounded-full bg-iris/40 blur-3xl" />
            <div aria-hidden className="gb-blob absolute -bottom-28 -left-16 size-64 rounded-full bg-peach/20 blur-3xl" style={{ animationDelay: "-9s" }} />
            <div className="relative">
              <Logo className="size-12" />
              <p className="mt-8 font-display text-3xl font-extrabold leading-tight tracking-tight">
                Tick it off.
                <br />
                <span className="text-peach">Watch it get done.</span>
              </p>
              <ul className="mt-8 space-y-4">
                {PERKS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-white/80">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/10 text-peach">
                      <Icon className="size-4" />
                    </span>
                    <span className="pt-1.5">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="relative mt-auto pt-10 text-xs text-white/50">No account? Guest mode keeps everything in this browser.</p>
          </section>

          <section className="p-6 sm:p-10">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-ink/60">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </section>
        </div>
      </main>
    </div>
  );
}
