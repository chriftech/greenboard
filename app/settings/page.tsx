import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsForm } from "@/components/settings/settings-form";
import { ProfileSettings } from "@/components/settings/profile-settings";

export const metadata: Metadata = {
  title: "Settings — Greenboard",
  description: "Your Greenboard profile, and how your board looks.",
};

export default function SettingsPage() {
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
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Greenboard home">
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">greenboard</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/board"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-surface hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            <span className="sm:hidden">Board</span>
            <span className="hidden sm:inline">Back to board</span>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-8">
        <section className="gb-rise relative overflow-hidden rounded-[28px] bg-deep p-6 text-white shadow-[0_30px_80px_-30px_rgb(46_51_73/0.7)] sm:p-8">
          <div aria-hidden className="gb-blob absolute -right-16 -top-24 size-72 rounded-full bg-iris/40 blur-3xl" />
          <div className="relative">
            <span className="grid size-12 place-items-center rounded-2xl bg-peach text-on-accent">
              <Settings className="size-6" />
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Settings</h1>
            <p className="mt-2 max-w-lg text-white/75">Your profile, and how your board looks.</p>
          </div>
        </section>

        <div className="mt-10 space-y-10">
          <ProfileSettings />
          <SettingsForm />
        </div>
      </main>
    </div>
  );
}
