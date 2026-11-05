import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  Flame,
  ListChecks,
  Plus,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Nav } from "@/components/landing/nav";
import { Logo } from "@/components/landing/logo";
import { HeroBoard } from "@/components/landing/hero-board";
import { TryIt } from "@/components/landing/try-it";
import { Reveal } from "@/components/landing/reveal";
import { Counter } from "@/components/landing/counter";

const MARQUEE = [
  "Ship the release",
  "Book the dentist",
  "Inbox zero",
  "Finish the slides",
  "Call mum",
  "Pay rent",
  "Fix the leaky tap",
  "Plan the sprint",
  "Gym — leg day",
  "Renew passport",
];

export default function Home() {
  return (
    <div id="top" className="relative flex-1 overflow-x-clip bg-cream text-forest">
      <Nav />
      <Hero />
      <Marquee />
      <Features />
      <HowItWorks />
      <TrySection />
      <Cta />
      <Footer />
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative px-4 pb-24 pt-32 sm:pt-40">
      {/* animated colour blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="gb-grid-bg absolute inset-0" />
        <div className="gb-blob absolute -left-24 top-10 size-[420px] rounded-full bg-zest/50 blur-3xl" />
        <div
          className="gb-blob absolute -right-20 top-40 size-[380px] rounded-full bg-skyblue/25 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="gb-blob absolute bottom-0 left-1/3 size-[340px] rounded-full bg-coral/20 blur-3xl"
          style={{ animationDelay: "-12s" }}
        />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
        <div className="text-center lg:text-left">
          <div
            className="gb-rise inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-3 py-1.5 text-sm font-medium text-forest/80 shadow-sm backdrop-blur"
            style={{ animationDelay: "0ms" }}
          >
            <span className="grid size-5 place-items-center rounded-full bg-zest">
              <Sparkles className="size-3 text-forest" />
            </span>
            Your to-do list, but joyful
          </div>

          <h1
            className="gb-rise mt-6 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "120ms" }}
          >
            Tick it off.
            <br />
            <span className="bg-gradient-to-r from-leaf via-[#0f9d6b] to-forest bg-clip-text text-transparent">
              Watch it go{" "}
            </span>
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-[#0f9d6b] to-forest bg-clip-text text-transparent">
                green.
              </span>
              <svg
                viewBox="0 0 300 20"
                preserveAspectRatio="none"
                className="gb-underline absolute -bottom-2 left-0 h-4 w-full"
                aria-hidden
              >
                <path
                  d="M3 14 C 60 4, 120 4, 170 10 S 260 16, 297 6"
                  pathLength={1}
                  fill="none"
                  stroke="#c8f251"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p
            className="gb-rise mx-auto mt-7 max-w-xl text-lg leading-relaxed text-forest/70 lg:mx-0"
            style={{ animationDelay: "240ms" }}
          >
            Greenboard turns your tasks into a board you&apos;ll actually love clearing. One tap
            to tick, a burst of colour to celebrate, and a clear view of everything that&apos;s
            done — for you and your whole team.
          </p>

          <div
            className="gb-rise mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
            style={{ animationDelay: "360ms" }}
          >
            <Link
              href="/board"
              className="gb-shine group inline-flex items-center gap-2 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-zest shadow-[0_12px_30px_-10px_rgb(7_53_42/0.7)] transition-transform hover:-translate-y-1"
            >
              Start ticking — it&apos;s free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-2xl border border-forest/15 bg-white px-6 py-4 text-base font-semibold text-forest transition-all hover:-translate-y-1 hover:border-leaf hover:shadow-md"
            >
              See how it works
            </a>
          </div>

          <ul
            className="gb-rise mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-forest/60 lg:justify-start"
            style={{ animationDelay: "480ms" }}
          >
            {["Free to start", "No credit card", "Works on any device"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-leaf" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="gb-rise flex justify-center" style={{ animationDelay: "300ms" }}>
          <HeroBoard />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Marquee ───────────────────────── */

function Marquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <div className="relative z-10 -rotate-2 bg-forest py-5 shadow-2xl">
      <div className="overflow-hidden">
        <div className="gb-marquee flex w-max gap-10">
          {items.map((t, i) => (
            <span
              key={i}
              className="flex items-center gap-3 font-display text-2xl font-bold whitespace-nowrap text-white"
            >
              <span className="grid size-7 place-items-center rounded-full bg-zest">
                <Check className="size-4 text-forest" strokeWidth={3.5} />
              </span>
              <span className="line-through decoration-zest decoration-[3px]">{t}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Features ───────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-leaf">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-lg text-forest/65">{sub}</p>}
    </Reveal>
  );
}

function Features() {
  const loopTasks = ["Draft the proposal", "Reply to Sarah", "Update the board"];
  return (
    <section id="features" className="scroll-mt-24 px-4 py-28 sm:py-36">
      <SectionHeading
        eyebrow="Features"
        title={
          <>
            Everything you need to <span className="text-leaf">get it done</span>
          </>
        }
        sub="No clutter. No 40-field forms. Just the good stuff that keeps you moving."
      />

      <div className="mx-auto mt-16 grid max-w-6xl gap-5 md:grid-cols-6">
        {/* One tap */}
        <Reveal className="md:col-span-4">
          <div className="group relative h-full overflow-hidden rounded-[28px] bg-zest p-8 transition-transform duration-500 hover:-translate-y-1.5 sm:p-10">
            <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
              <div>
                <div className="grid size-12 place-items-center rounded-2xl bg-forest text-zest">
                  <Zap className="size-6" />
                </div>
                <h3 className="mt-5 font-display text-3xl font-extrabold">One tap. Done.</h3>
                <p className="mt-3 text-forest/75">
                  Ticking a task should feel good. Every check fills, every line strikes through,
                  and your board gets a little greener.
                </p>
              </div>
              <ul className="space-y-3 rounded-3xl bg-white/70 p-4 shadow-inner backdrop-blur">
                {loopTasks.map((t, i) => (
                  <li
                    key={t}
                    className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                    style={{ animationDelay: `${i * 0.6}s` } as CSSProperties}
                  >
                    <span
                      className="gb-loop-check grid size-6 shrink-0 place-items-center rounded-full border-2"
                      style={{ animationDelay: `${i * 0.6}s` }}
                    >
                      <Check className="size-3.5 text-white" strokeWidth={4} />
                    </span>
                    <span
                      className="gb-loop-strike font-medium"
                      style={{ animationDelay: `${i * 0.6}s` }}
                    >
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Shared boards */}
        <Reveal className="md:col-span-2" delay={100}>
          <div className="relative h-full overflow-hidden rounded-[28px] bg-skyblue p-8 text-white transition-transform duration-500 hover:-translate-y-1.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-white/20 backdrop-blur">
              <Users className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-extrabold">Shared boards</h3>
            <p className="mt-2 text-white/85">
              Invite your team and watch tasks go green in real time.
            </p>
            <div className="mt-6 flex -space-x-3">
              {[
                ["CS", "bg-coral"],
                ["AM", "bg-grape"],
                ["JK", "bg-sunny text-forest"],
                ["+4", "bg-forest text-zest"],
              ].map(([n, c], i) => (
                <span
                  key={n}
                  className={`gb-float grid size-11 place-items-center rounded-full border-[3px] border-skyblue text-sm font-bold ${c}`}
                  style={{ animationDelay: `${-i * 0.7}s`, animationDuration: "4s" }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Streaks */}
        <Reveal className="md:col-span-2" delay={0}>
          <div className="relative h-full overflow-hidden rounded-[28px] bg-coral p-8 text-white transition-transform duration-500 hover:-translate-y-1.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-white/20">
              <Flame className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-extrabold">Streaks that stick</h3>
            <p className="mt-2 text-white/85">Build momentum day after day — don&apos;t break the chain.</p>
            <div className="mt-6 flex h-20 items-end gap-2">
              {[0.5, 0.7, 0.4, 0.9, 0.6, 1, 0.8].map((h, i) => (
                <span
                  key={i}
                  className="gb-bar flex-1 rounded-t-lg bg-white/85"
                  style={{ height: `${h * 100}%`, animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        </Reveal>

        {/* Reminders */}
        <Reveal className="md:col-span-2" delay={100}>
          <div className="relative h-full overflow-hidden rounded-[28px] bg-sunny p-8 transition-transform duration-500 hover:-translate-y-1.5">
            <div className="gb-wiggle grid size-12 place-items-center rounded-2xl bg-forest text-sunny">
              <BellRing className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-extrabold">Gentle nudges</h3>
            <p className="mt-2 text-forest/75">
              Friendly reminders at the right moment. Never naggy, never noisy.
            </p>
            <div className="mt-6 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium shadow-sm">
              ⏰ &ldquo;Send invoice&rdquo; is due in 1 hour
            </div>
          </div>
        </Reveal>

        {/* Progress */}
        <Reveal className="md:col-span-2" delay={200}>
          <div className="relative h-full overflow-hidden rounded-[28px] bg-grape p-8 text-white transition-transform duration-500 hover:-translate-y-1.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-white/20">
              <ListChecks className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-extrabold">Progress at a glance</h3>
            <p className="mt-2 text-white/85">See what&apos;s done, what&apos;s left, and who did what.</p>
            <div className="relative mt-6 size-20">
              <svg viewBox="0 0 80 80" className="gb-spin-slow size-20">
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgb(255 255 255/0.2)" strokeWidth="10" />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="#c8f251"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="201"
                  strokeDashoffset="50"
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-sm font-bold">75%</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    {
      icon: Plus,
      title: "Add your tasks",
      body: "Dump everything on your board in seconds — type it, paste it, done.",
      color: "bg-zest text-forest",
    },
    {
      icon: Check,
      title: "Tick them off",
      body: "One tap marks a task done. Feel the little hit of progress every time.",
      color: "bg-leaf text-white",
    },
    {
      icon: Sparkles,
      title: "Watch it go green",
      body: "Your board fills with colour as you go. A fully green board = a great day.",
      color: "bg-forest text-zest",
    },
  ];

  return (
    <section id="how" className="relative scroll-mt-24 bg-mint px-4 py-28 sm:py-36">
      <SectionHeading
        eyebrow="How it works"
        title="Three steps to a greener day"
        sub="If you can tick a box, you already know how to use Greenboard."
      />

      <div className="relative mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
        <div
          aria-hidden
          className="absolute left-[16%] right-[16%] top-12 hidden border-t-[3px] border-dashed border-leaf/40 md:block"
        />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 150}>
            <div className="relative flex h-full flex-col items-center rounded-[28px] bg-white p-8 text-center shadow-[0_20px_50px_-30px_rgb(7_53_42/0.45)] transition-transform duration-500 hover:-translate-y-2">
              <div className={`relative grid size-16 place-items-center rounded-2xl ${s.color} shadow-lg`}>
                <s.icon className="size-7" strokeWidth={2.5} />
                <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-coral text-xs font-bold text-white ring-4 ring-white">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 text-forest/65">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Try it ───────────────────────── */

function TrySection() {
  const stats = [
    { to: 1, suffix: "", label: "tap to tick a task" },
    { to: 100, suffix: "%", label: "more satisfying than paper" },
    { to: 0, suffix: "", label: "clutter, setup or learning curve" },
  ];
  return (
    <section id="try" className="scroll-mt-24 px-4 py-28 sm:py-36">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-leaf">Try it now</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Go on. <span className="text-coral">Tick something.</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-forest/65">
            This is a real, working board. Tap a task and see what Greenboard feels like.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-forest/10 bg-white p-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-4xl font-extrabold text-leaf">
                  <Counter to={s.to} suffix={s.suffix} />
                </dd>
                <p className="mt-1 text-xs font-medium leading-snug text-forest/60">{s.label}</p>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={150}>
          <TryIt />
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── CTA ───────────────────────── */

function Cta() {
  const bubbles = [
    { cls: "left-[6%] top-[18%] size-14 bg-zest", d: "0s" },
    { cls: "right-[8%] top-[14%] size-10 bg-coral", d: "-2s" },
    { cls: "left-[12%] bottom-[14%] size-9 bg-skyblue", d: "-4s" },
    { cls: "right-[14%] bottom-[18%] size-12 bg-sunny", d: "-1s" },
  ];
  return (
    <section id="start" className="scroll-mt-24 px-4 pb-24">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[36px] bg-forest px-6 py-20 text-center sm:px-12 sm:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="gb-blob absolute -left-20 -top-20 size-80 rounded-full bg-leaf/40 blur-3xl" />
            <div
              className="gb-blob absolute -bottom-24 -right-16 size-96 rounded-full bg-zest/20 blur-3xl"
              style={{ animationDelay: "-8s" }}
            />
            {bubbles.map((b, i) => (
              <span
                key={i}
                className={`gb-float absolute hidden place-items-center rounded-full sm:grid ${b.cls}`}
                style={{ animationDelay: b.d, "--rot": `${i % 2 ? 8 : -8}deg` } as CSSProperties}
              >
                <Check className="size-1/2 text-forest" strokeWidth={3.5} />
              </span>
            ))}
          </div>

          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
              Ready to turn your board <span className="text-zest">green</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
              Start free in seconds. Your future, very-productive self says thanks.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/board"
                className="gb-shine group inline-flex items-center gap-2 rounded-2xl bg-zest px-7 py-4 text-base font-bold text-forest shadow-[0_12px_40px_-8px_rgb(200_242_81/0.6)] transition-transform hover:-translate-y-1 hover:scale-[1.02]"
              >
                Create my board
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#try"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Try the demo first
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-forest/10 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <a href="#top" className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="font-display text-lg font-bold">greenboard</span>
        </a>
        <nav className="flex gap-6 text-sm text-forest/60">
          <a href="#features" className="hover:text-forest">Features</a>
          <a href="#how" className="hover:text-forest">How it works</a>
          <a href="#try" className="hover:text-forest">Try it</a>
        </nav>
        <p className="text-sm text-forest/50">© 2026 Greenboard</p>
      </div>
    </footer>
  );
}
