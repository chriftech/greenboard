"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Crown, Minus, Rocket, Sprout } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

type Billing = "monthly" | "yearly";

/** A benefit, with an optional "Soon" note for things still being built. */
type Benefit = { text: string; soon?: boolean };

type Plan = {
  id: "free" | "standard" | "premium";
  name: string;
  tagline: string;
  /** US dollars per month; yearly billing charges ten months for twelve. */
  monthly: number;
  icon: typeof Sprout;
  cta: { label: string; href: string };
  /** The line above the list, e.g. "Everything in Free, plus:". */
  lead: string;
  benefits: Benefit[];
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For getting your own day in order.",
    monthly: 0,
    icon: Sprout,
    cta: { label: "Start for free", href: "/board" },
    lead: "Includes:",
    benefits: [
      { text: "Your personal board, with unlimited tasks" },
      { text: "Todo and Completed, plus up to 2 columns of your own" },
      { text: "Subtasks, priorities, assignees and timelines" },
      { text: "Today and Upcoming views" },
      { text: "Default, Errands and Work tags, and up to 5 tags of your own" },
      { text: "Select tasks in bulk: move, copy, tag and complete" },
      { text: "Workflow rules for which moves are allowed" },
      { text: "Import from CSV or Excel, export to CSV" },
      { text: "Trash keeps deleted tasks for 30 days" },
      { text: "Use it as a guest, no account needed" },
    ],
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "For busy people juggling more than one list.",
    monthly: 9.99,
    icon: Rocket,
    cta: { label: "Choose Standard", href: "/signup?plan=standard" },
    lead: "Everything in Free, plus:",
    featured: true,
    benefits: [
      { text: "Unlimited boards, each with its own tasks", soon: true },
      { text: "Your boards synced on every device", soon: true },
      { text: "Unlimited custom tags" },
      { text: "Up to 12 columns of your own per board" },
      { text: "Email reminders before tasks are due", soon: true },
      { text: "Trash keeps deleted tasks for 90 days" },
      { text: "Email support" },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "For teams who clear boards together.",
    monthly: 19.99,
    icon: Crown,
    cta: { label: "Choose Premium", href: "/signup?plan=premium" },
    lead: "Everything in Standard, plus:",
    benefits: [
      { text: "Shared boards with your team", soon: true },
      { text: "Invite teammates and assign tasks to them", soon: true },
      { text: "Live updates as teammates tick tasks off", soon: true },
      { text: "Unlimited columns of your own" },
      { text: "Excel export with your board's layout", soon: true },
      { text: "Trash keeps deleted tasks for a year" },
      { text: "Priority support, answered within a day" },
      { text: "Early access to new features" },
    ],
  },
];

/** The comparison table: one row per feature, a value per plan (true = included, false = not). */
const COMPARE: { feature: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { feature: "Boards", values: ["1 personal board", "Unlimited", "Unlimited + shared"] },
  { feature: "Tasks", values: ["Unlimited", "Unlimited", "Unlimited"] },
  { feature: "Columns of your own", values: ["Up to 2", "Up to 12 per board", "Unlimited"] },
  { feature: "Tags you can create", values: ["Up to 5", "Unlimited", "Unlimited"] },
  { feature: "Subtasks, priorities and timelines", values: [true, true, true] },
  { feature: "Bulk select, move and copy", values: [true, true, true] },
  { feature: "CSV and Excel import, CSV export", values: [true, true, true] },
  { feature: "Workflow rules", values: [true, true, true] },
  { feature: "Sync across devices", values: [false, true, true] },
  { feature: "Email reminders", values: [false, true, true] },
  { feature: "Team members and shared boards", values: [false, false, true] },
  { feature: "Excel export", values: [false, false, true] },
  { feature: "Trash history", values: ["30 days", "90 days", "1 year"] },
  { feature: "Support", values: ["Help centre", "Email", "Priority, within a day"] },
];

const FAQ = [
  {
    q: "Is Free really free?",
    a: "Yes. No card, no trial clock. Your personal board and everything listed under Free stay free.",
  },
  {
    q: "What does “Soon” mean?",
    a: "Those benefits are being built now. They switch on for Standard and Premium as soon as they're ready, at no extra cost.",
  },
  {
    q: "Can I switch plans later?",
    a: "Any time. Moving up gives you the new benefits straight away; moving down keeps your tasks, and anything over the new plan's limits becomes read-only.",
  },
  {
    q: "How does yearly billing work?",
    a: "You pay for ten months and get twelve, billed once a year.",
  },
];

const price = (plan: Plan, billing: Billing) => (billing === "yearly" ? (plan.monthly * 10) / 12 : plan.monthly);
const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export function PricingPlans() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <>
      {/* Monthly / yearly switch */}
      <div className="gb-rise mt-10 flex justify-center" style={{ animationDelay: "240ms" }}>
        <div role="radiogroup" aria-label="Billing period" className="inline-flex items-center gap-1 rounded-2xl border border-ink/10 bg-surface p-1 shadow-sm">
          {(["monthly", "yearly"] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={billing === b}
              onClick={() => setBilling(b)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                billing === b ? "bg-deep text-on-deep shadow" : "text-ink/60 hover:text-ink"
              }`}
            >
              {b === "monthly" ? "Monthly" : "Yearly"}
              {b === "yearly" && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${billing === b ? "bg-peach text-on-accent" : "bg-success/15 text-success"}`}>
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* The three plans */}
      <div className="mx-auto mt-14 grid max-w-6xl items-stretch gap-6 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.id} delay={i * 120} className="h-full">
            <PlanCard plan={plan} billing={billing} />
          </Reveal>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-ink/50">
        Prices in US dollars, per person. Benefits marked <SoonBadge /> are on their way and switch on for your plan when they
        launch.
      </p>

      <Compare />
      <Faq />
    </>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const amount = price(plan, billing);
  const featured = plan.featured;
  const Icon = plan.icon;

  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className={`relative flex h-full flex-col rounded-[28px] p-7 transition-transform duration-500 hover:-translate-y-1.5 sm:p-8 ${
        featured
          ? "bg-deep text-on-deep shadow-[0_30px_70px_-25px_rgb(46_51_73/0.75)] ring-2 ring-iris lg:-my-4 lg:py-12"
          : "border border-ink/10 bg-surface shadow-[0_20px_50px_-30px_rgb(46_51_73/0.45)]"
      }`}
    >
      {featured && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-peach px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-on-accent shadow-lg">
          Most popular
        </span>
      )}

      <div className="flex items-center gap-3">
        <span
          className={`grid size-11 place-items-center rounded-2xl ${
            plan.id === "free" ? "bg-success/15 text-success" : featured ? "bg-white/15 text-peach" : "bg-iris/15 text-iris"
          }`}
        >
          <Icon className="size-5" strokeWidth={2.5} />
        </span>
        <h3 id={`plan-${plan.id}`} className="font-display text-2xl font-bold">
          {plan.name}
        </h3>
      </div>
      <p className={`mt-3 text-sm ${featured ? "text-on-deep/70" : "text-ink/60"}`}>{plan.tagline}</p>

      <div className="mt-6 flex items-end gap-1.5">
        <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums">{money(amount)}</span>
        <span className={`pb-1.5 text-sm font-medium ${featured ? "text-on-deep/60" : "text-ink/50"}`}>
          {plan.monthly === 0 ? "forever" : "/ month"}
        </span>
      </div>
      <p className={`mt-1 h-5 text-xs ${featured ? "text-on-deep/55" : "text-ink/45"}`}>
        {plan.monthly === 0 ? "No card needed" : billing === "yearly" ? `${money(plan.monthly * 10)} billed yearly` : "Billed monthly"}
      </p>

      <Link
        href={plan.cta.href}
        className={`group mt-7 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 ${
          featured
            ? "gb-shine bg-peach text-on-accent shadow-[0_12px_30px_-10px_rgb(255_201_169/0.6)]"
            : plan.id === "free"
              ? "bg-deep text-on-deep"
              : "border border-ink/15 bg-paper text-ink hover:border-iris"
        }`}
      >
        {plan.cta.label}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </Link>

      <div className={`my-7 h-px ${featured ? "bg-white/15" : "bg-ink/10"}`} />

      <p className={`text-xs font-bold uppercase tracking-widest ${featured ? "text-on-deep/60" : "text-ink/50"}`}>{plan.lead}</p>
      <ul className="mt-4 space-y-3">
        {plan.benefits.map((b) => (
          <li key={b.text} className="flex items-start gap-3 text-sm leading-relaxed">
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                featured ? "bg-peach text-on-accent" : plan.id === "free" ? "bg-success text-white" : "bg-iris text-white"
              }`}
            >
              <Check className="size-3" strokeWidth={3.5} />
            </span>
            <span className={featured ? "text-on-deep/90" : "text-ink/80"}>
              {b.text}
              {b.soon && (
                <>
                  {" "}
                  <SoonBadge onDark={featured} />
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SoonBadge({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-1.5 py-px align-[1px] text-[10px] font-bold uppercase tracking-wider ${
        onDark ? "bg-white/15 text-peach" : "bg-sunny/25 text-[#8a5a00] dark:text-[#ffd77a]"
      }`}
    >
      Soon
    </span>
  );
}

/* ───────────────────────── Comparison ───────────────────────── */

function Compare() {
  return (
    <section aria-labelledby="compare" className="mx-auto mt-28 max-w-5xl">
      <Reveal className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-iris">Compare</p>
        <h2 id="compare" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Every plan, side by side
        </h2>
      </Reveal>

      <Reveal className="mt-10">
        {/* Scrolls sideways on phones rather than squeezing the columns. */}
        <div className="overflow-x-auto rounded-[24px] border border-ink/10 bg-surface shadow-[0_20px_50px_-30px_rgb(46_51_73/0.45)]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th scope="col" className="px-5 py-4 font-semibold text-ink/50">
                  Feature
                </th>
                {PLANS.map((p) => (
                  <th key={p.id} scope="col" className={`px-5 py-4 text-center font-display text-base font-bold ${p.featured ? "bg-iris/[0.08] text-iris" : ""}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.feature} className="border-b border-ink/5 last:border-0">
                  <th scope="row" className="px-5 py-3.5 font-medium text-ink/80">
                    {row.feature}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-5 py-3.5 text-center ${PLANS[i].featured ? "bg-iris/[0.08]" : ""}`}>
                      {v === true ? (
                        <Check aria-label="Included" className="mx-auto size-4 text-success" strokeWidth={3} />
                      ) : v === false ? (
                        <Minus aria-label="Not included" className="mx-auto size-4 text-ink/25" />
                      ) : (
                        <span className="font-medium text-ink/75">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function Faq() {
  return (
    <section aria-labelledby="pricing-faq" className="mx-auto mt-28 max-w-3xl">
      <Reveal className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-iris">Questions</p>
        <h2 id="pricing-faq" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Good to know
        </h2>
      </Reveal>
      <div className="mt-10 space-y-3">
        {FAQ.map((f, i) => (
          <Reveal key={f.q} delay={i * 80}>
            <details className="group rounded-2xl border border-ink/10 bg-surface px-5 py-4 open:shadow-[0_14px_40px_-25px_rgb(46_51_73/0.5)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-mist text-ink/60 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
