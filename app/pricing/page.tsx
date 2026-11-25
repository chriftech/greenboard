import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { PricingPlans } from "@/components/pricing/pricing-plans";

export const metadata: Metadata = {
  title: "Pricing — Greenboard",
  description: "Greenboard's Free, Standard and Premium plans, and what each one includes.",
};

export default function PricingPage() {
  return (
    <div className="relative flex-1 overflow-x-clip bg-paper text-ink">
      <Nav />
      <main className="relative px-4 pb-28 pt-32 sm:pt-40">
        {/* Soft colour behind the heading, like the landing page. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] overflow-hidden">
          <div className="gb-grid-bg absolute inset-0" />
          <div className="gb-blob absolute -left-24 top-16 size-[380px] rounded-full bg-peach/40 blur-3xl dark:bg-peach/10" />
          <div
            className="gb-blob absolute -right-20 top-28 size-[360px] rounded-full bg-iris/20 blur-3xl"
            style={{ animationDelay: "-6s" }}
          />
        </div>

        <div className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <div className="gb-rise inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface/70 px-3 py-1.5 text-sm font-medium text-ink/80 shadow-sm backdrop-blur">
              <span className="grid size-5 place-items-center rounded-full bg-peach">
                <Sparkles className="size-3 text-on-accent" />
              </span>
              Simple, honest pricing
            </div>
            <h1
              className="gb-rise mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              A plan for every{" "}
              <span className="bg-gradient-to-r from-iris to-[#7c93f7] bg-clip-text text-transparent">board</span>
            </h1>
            <p className="gb-rise mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink/65" style={{ animationDelay: "160ms" }}>
              Start free and stay free for as long as you like. Upgrade when you want more boards, sync and a team to
              tick things off with.
            </p>
          </div>

          <PricingPlans />
        </div>
      </main>
      <Footer />
    </div>
  );
}
