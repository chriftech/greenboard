"use client";

import { useId, type ReactNode } from "react";
import { Hand } from "lucide-react";
import { setSetting, useSettings } from "@/lib/settings";
import { useHydrated } from "@/lib/hydrated";
import { SwitchSkeleton } from "./settings-skeleton";

/** The board preferences. Changes save straight away, in this browser. */
export function SettingsForm() {
  const settings = useSettings();

  return (
    <section aria-labelledby="board-settings" className="gb-rise" style={{ animationDelay: "120ms" }}>
      <h2 id="board-settings" className="px-1 text-xs font-semibold uppercase tracking-widest text-ink/50">
        Board
      </h2>
      <div className="mt-3 overflow-hidden rounded-[24px] border border-ink/10 bg-surface shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)]">
        <ToggleRow
          icon={<Hand className="size-4" />}
          title="Greeting card"
          description="Show the “Good morning” card at the top of your board, with today’s date and how many tasks are left."
          checked={settings.showGreeting}
          onChange={(on) => setSetting("showGreeting", on)}
        />
      </div>
      <p className="mt-3 px-1 text-sm text-ink/50">Settings are saved in this browser and apply straight away.</p>
    </section>
  );
}

export function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  const hydrated = useHydrated();
  return (
    <div className="flex items-start gap-4 p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mist text-iris">{icon}</span>
      <div className="min-w-0 flex-1">
        <p id={`${id}-title`} className="font-semibold">
          {title}
        </p>
        <p id={`${id}-desc`} className="mt-0.5 text-sm text-ink/60">
          {description}
        </p>
      </div>
      {/* The saved value lives in this browser, so the prerendered page can't know it yet. */}
      {!hydrated ? (
        <SwitchSkeleton />
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          onClick={() => onChange(!checked)}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris ${
            checked ? "bg-success" : "bg-ink/20"
          }`}
        >
          <span
            aria-hidden
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      )}
    </div>
  );
}
