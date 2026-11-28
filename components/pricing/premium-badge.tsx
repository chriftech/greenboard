import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Crown } from "lucide-react";
import { PLAN_NAMES, type PaidPlan } from "@/lib/plan";

/** The gold look shared by every paid-feature marker. */
const gold = "bg-sunny/25 text-[#8a5a00] dark:bg-sunny/15 dark:text-[#ffd77a]";

/**
 * Marks a feature that comes with a subscription: a crown and the plan's name,
 * or only the crown (with the name for screen readers) where space is tight.
 */
export function PremiumBadge({ plan = "standard", iconOnly = false, className = "" }: { plan?: PaidPlan; iconOnly?: boolean; className?: string }) {
  const name = PLAN_NAMES[plan];
  if (iconOnly) {
    return (
      <span title={`With ${name}`} className={`inline-grid size-5 shrink-0 place-items-center rounded-full ${gold} ${className}`}>
        <Crown aria-hidden className="size-3" />
        <span className="sr-only">{name} feature</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${gold} ${className}`}>
      <Crown aria-hidden className="size-3" />
      {name}
    </span>
  );
}

/** A paid feature the user has reached: what it is, and a link to the pricing page. */
export function UpgradeNote({ plan = "standard", children, className = "" }: { plan?: PaidPlan; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-sunny/40 bg-sunny/10 px-4 py-3 text-sm ${className}`}>
      <PremiumBadge plan={plan} />
      <span className="min-w-0 flex-1 text-ink/70">{children}</span>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1 rounded-lg font-semibold text-ink underline-offset-4 hover:underline"
      >
        See plans
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
