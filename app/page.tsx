import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Plus,
  Sparkles,
} from "lucide-react";
import { Nav } from "@/components/landing/nav";
import { Logo } from "@/components/landing/logo";
import { HeroBoard } from "@/components/landing/hero-board";
import { Reveal } from "@/components/landing/reveal";

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
    <div id="top" className="relative flex-1 overflow-x-clip bg-paper text-ink">
      <Nav />
      <Hero />
      <Marquee />
      <HowItWorks />
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
        <div className="gb-blob absolute -left-24 top-10 size-[420px] rounded-full bg-peach/50 blur-3xl" />
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
            className="gb-rise inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-3 py-1.5 text-sm font-medium text-ink/80 shadow-sm backdrop-blur"
            style={{ animationDelay: "0ms" }}
          >
            <span className="grid size-5 place-items-center rounded-full bg-peach">
              <Sparkles className="size-3 text-ink" />
            </span>
            Your to-do list, but joyful
          </div>

          <h1
            className="gb-rise mt-6 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "120ms" }}
          >
            Tick it off.
            <br />
            <span className="bg-gradient-to-r from-iris via-[#7c93f7] to-ink bg-clip-text text-transparent">
              Watch it get{" "}
            </span>
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-[#7c93f7] to-ink bg-clip-text text-transparent">
                done.
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
                  stroke="#ffc9a9"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p
            className="gb-rise mx-auto mt-7 max-w-xl text-lg leading-relaxed text-ink/70 lg:mx-0"
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
              className="gb-shine group inline-flex items-center gap-2 rounded-2xl bg-ink px-6 py-4 text-base font-semibold text-peach shadow-[0_12px_30px_-10px_rgb(46_51_73/0.7)] transition-transform hover:-translate-y-1"
            >
              Start ticking — it&apos;s free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-white px-6 py-4 text-base font-semibold text-ink transition-all hover:-translate-y-1 hover:border-iris hover:shadow-md"
            >
              See how it works
            </a>
          </div>

          <ul
            className="gb-rise mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink/60 lg:justify-start"
            style={{ animationDelay: "480ms" }}
          >
            {["Free to start", "No credit card", "Works on any device"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-iris" strokeWidth={3} />
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
    <div className="relative z-10 -rotate-2 bg-ink py-5 shadow-2xl">
      <div className="overflow-hidden">
        <div className="gb-marquee flex w-max gap-10">
          {items.map((t, i) => (
            <span
              key={i}
              className="flex items-center gap-3 font-display text-2xl font-bold whitespace-nowrap text-white"
            >
              <span className="grid size-7 place-items-center rounded-full bg-success">
                <Check className="size-4 text-white" strokeWidth={3.5} />
              </span>
              <span className="line-through decoration-success decoration-[3px]">{t}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Section heading ───────────────────────── */

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
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-iris">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-lg text-ink/65">{sub}</p>}
    </Reveal>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    {
      icon: Plus,
      title: "Add your tasks",
      body: "Dump everything on your board in seconds — type it, paste it, done.",
      color: "bg-peach text-ink",
    },
    {
      icon: Check,
      title: "Tick them off",
      body: "One tap marks a task done. Feel the little hit of progress every time.",
      color: "bg-success text-white",
    },
    {
      icon: Sparkles,
      title: "Watch it come together",
      body: "Your board fills with colour as you go. A fully ticked board = a great day.",
      color: "bg-ink text-peach",
    },
  ];

  return (
    <section id="how" className="relative scroll-mt-24 bg-mist px-4 py-28 sm:py-36">
      <SectionHeading
        eyebrow="How it works"
        title="Three steps to a clearer day"
        sub="If you can tick a box, you already know how to use Greenboard."
      />

      <div className="relative mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
        <div
          aria-hidden
          className="absolute left-[16%] right-[16%] top-12 hidden border-t-[3px] border-dashed border-iris/40 md:block"
        />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 150}>
            <div className="relative flex h-full flex-col items-center rounded-[28px] bg-white p-8 text-center shadow-[0_20px_50px_-30px_rgb(46_51_73/0.45)] transition-transform duration-500 hover:-translate-y-2">
              <div className={`relative grid size-16 place-items-center rounded-2xl ${s.color} shadow-lg`}>
                <s.icon className="size-7" strokeWidth={2.5} />
                <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-coral text-xs font-bold text-white ring-4 ring-white">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 text-ink/65">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── CTA ───────────────────────── */

function Cta() {
  const bubbles = [
    { cls: "left-[6%] top-[18%] size-14 bg-peach", d: "0s" },
    { cls: "right-[8%] top-[14%] size-10 bg-coral", d: "-2s" },
    { cls: "left-[12%] bottom-[14%] size-9 bg-skyblue", d: "-4s" },
    { cls: "right-[14%] bottom-[18%] size-12 bg-sunny", d: "-1s" },
  ];
  return (
    <section id="start" className="scroll-mt-24 px-4 pb-24">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[36px] bg-ink px-6 py-20 text-center sm:px-12 sm:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="gb-blob absolute -left-20 -top-20 size-80 rounded-full bg-iris/40 blur-3xl" />
            <div
              className="gb-blob absolute -bottom-24 -right-16 size-96 rounded-full bg-peach/20 blur-3xl"
              style={{ animationDelay: "-8s" }}
            />
            {bubbles.map((b, i) => (
              <span
                key={i}
                className={`gb-float absolute hidden place-items-center rounded-full sm:grid ${b.cls}`}
                style={{ animationDelay: b.d, "--rot": `${i % 2 ? 8 : -8}deg` } as CSSProperties}
              >
                <Check className="size-1/2 text-ink" strokeWidth={3.5} />
              </span>
            ))}
          </div>

          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
              Ready to <span className="text-peach">clear</span> your board?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
              Start free in seconds. Your future, very-productive self says thanks.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/board"
                className="gb-shine group inline-flex items-center gap-2 rounded-2xl bg-peach px-7 py-4 text-base font-bold text-ink shadow-[0_12px_40px_-8px_rgb(255_201_169/0.6)] transition-transform hover:-translate-y-1 hover:scale-[1.02]"
              >
                Create my board
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                See how it works
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
    <footer className="border-t border-ink/10 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <a href="#top" className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="font-display text-lg font-bold">greenboard</span>
        </a>
        <nav className="flex gap-6 text-sm text-ink/60">
          <a href="#how" className="hover:text-ink">How it works</a>
        </nav>
        <p className="text-sm text-ink/50">© 2026 Greenboard</p>
      </div>
    </footer>
  );
}
