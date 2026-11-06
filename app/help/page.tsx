import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Keyboard, LifeBuoy, MessageSquare } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedbackForm } from "@/components/help/feedback-form";

export const metadata: Metadata = {
  title: "Help & feedback — Greenboard",
  description: "How to use Greenboard, keyboard shortcuts, and how to send feedback.",
};

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "How do I add a task?",
    a: (
      <>
        On your board, pick a tag at the top of the form, type the task into <b>What needs doing?</b> and press{" "}
        <b>Enter</b> (or click <b>Add task</b>). New tasks go to the top of the board.
      </>
    ),
  },
  {
    q: "How do I tick a task off, or undo it?",
    a: (
      <>
        Click the circle on the left of a task. It turns green and the text is struck through. Click it again to
        mark the task as not done. The <b>Pending</b> and <b>Completed</b> tabs split the two.
      </>
    ),
  },
  {
    q: "How do I add notes or rename a task?",
    a: (
      <>
        Click a task to open its details panel. There you can rename it, change its tag and timeline, and write a
        description with <b>bold</b>, <i>italic</i>, <u>underline</u> and bullet points. Everything saves
        automatically.
      </>
    ),
  },
  {
    q: "What is a timeline?",
    a: (
      <>
        A start and an end for a task, each with a date <b>and</b> a time. Add one with <b>Add timeline</b> in the
        form or the <b>Timeline</b> section of the details panel. The end has to be after the start. Tasks then show
        badges like <b>Today</b>, <b>In progress</b> or <b>Overdue</b>, and appear under <b>Today</b> and{" "}
        <b>Upcoming</b> in the sidebar.
      </>
    ),
  },
  {
    q: "How do custom tags work?",
    a: (
      <>
        Besides the six built-in tags, you can make up to <b>5</b> of your own with <b>New tag</b> in the sidebar.
        Give each a name and any colour. Use the pencil to edit one and the bin to delete it; deleting a tag moves its
        tasks to <b>Default</b>, so nothing is lost.
      </>
    ),
  },
  {
    q: "Can I reorder tasks?",
    a: (
      <>
        Yes. Drag a card up or down. On a phone, press and hold first. With a keyboard, focus a task&apos;s grip
        handle, press <b>Space</b>, move it with the arrow keys and press <b>Space</b> again. <b>Today</b> and{" "}
        <b>Upcoming</b> are sorted by time, so dragging is off there.
      </>
    ),
  },
  {
    q: "I deleted a task by mistake. Can I get it back?",
    a: (
      <>
        Yes, for 30 days. Deleted tasks go to <b>Trash</b> in the sidebar, where you can <b>Restore</b> them. After 30
        days they&apos;re deleted for good automatically. You can also delete them forever sooner, or empty the Trash.
      </>
    ),
  },
  {
    q: "Where are my tasks saved?",
    a: (
      <>
        In this browser, on this device. They stay after you close the tab, but they don&apos;t sync to other
        browsers or devices yet, and clearing your browser&apos;s site data erases them.
      </>
    ),
  },
  {
    q: "How do I switch to dark mode?",
    a: (
      <>
        Use the sun/moon button next to <b>Home</b> (or at the top of this page). Until you pick one, Greenboard
        follows your device&apos;s light or dark setting.
      </>
    ),
  },
  {
    q: "Can I resize or hide the sidebar?",
    a: (
      <>
        Drag its right edge to resize it, double-click the edge to reset, or use the collapse button to shrink it to
        icons. On a phone, open it with the <b>Menu</b> button.
      </>
    ),
  },
];

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["⌘ / Ctrl", "K"], action: "Search tasks" },
  { keys: ["Enter"], action: "Add the task you're typing" },
  { keys: ["Esc"], action: "Close a panel or dialog, or clear the search" },
  { keys: ["Space", "↑ ↓", "Space"], action: "Pick up, move and drop a task (from its grip)" },
  { keys: ["⌘ / Ctrl", "B · I · U"], action: "Bold, italic, underline in a description" },
  { keys: ["⌘ / Ctrl", "⇧", "8"], action: "Bullet list in a description" },
  { keys: ["← →"], action: "Resize the sidebar (with its edge focused)" },
];

export default function HelpPage() {
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

      <header className="relative mx-auto flex max-w-3xl items-center justify-between px-4 pt-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Greenboard home">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/board"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-surface hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Back to board
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-8">
        {/* Intro */}
        <section className="gb-rise relative overflow-hidden rounded-[28px] bg-deep p-6 text-white shadow-[0_30px_80px_-30px_rgb(46_51_73/0.7)] sm:p-8">
          <div aria-hidden className="gb-blob absolute -right-16 -top-24 size-72 rounded-full bg-iris/40 blur-3xl" />
          <div className="relative">
            <span className="grid size-12 place-items-center rounded-2xl bg-peach text-on-accent">
              <LifeBuoy className="size-6" />
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Help & feedback</h1>
            <p className="mt-2 max-w-lg text-white/75">
              Answers to common questions, the keyboard shortcuts, and a way to tell us what to build or fix next.
            </p>
            <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
              {[
                ["#faq", "Questions"],
                ["#shortcuts", "Shortcuts"],
                ["#feedback", "Send feedback"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-12 scroll-mt-6">
          <h2 className="font-display text-2xl font-bold">Questions</h2>
          <div className="mt-4 space-y-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-2xl border border-ink/10 bg-surface transition-shadow open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="size-4 shrink-0 text-ink/40 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 leading-relaxed text-ink/70">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Shortcuts */}
        <section id="shortcuts" className="mt-12 scroll-mt-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Keyboard className="size-6 text-iris" />
            Keyboard shortcuts
          </h2>
          <dl className="mt-4 divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
            {SHORTCUTS.map(({ keys, action }) => (
              <div key={action} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-sm text-ink/75">{action}</dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                  {keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="rounded-lg border border-ink/15 bg-paper px-2 py-0.5 font-mono text-xs font-semibold text-ink shadow-[inset_0_-2px_0_rgb(46_51_73/0.08)]"
                    >
                      {k}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Feedback */}
        <section id="feedback" className="mt-12 scroll-mt-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <MessageSquare className="size-6 text-iris" />
            Send feedback
          </h2>
          <p className="mt-2 text-ink/65">Found a bug, have an idea, or a question? Tell us.</p>
          <div className="mt-4 rounded-[28px] border border-ink/10 bg-surface p-5 sm:p-6">
            <FeedbackForm />
          </div>
        </section>
      </main>
    </div>
  );
}
