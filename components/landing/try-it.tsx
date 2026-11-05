"use client";

import { useState } from "react";
import { CheckBox, ConfettiBurst } from "./check-box";

const ITEMS = [
  "Read about Greenboard",
  "Tick this box (go on!)",
  "Feel weirdly satisfied",
  "Share it with your team",
];

/** Interactive checklist: every tick bursts confetti. */
export function TryIt() {
  const [checked, setChecked] = useState<boolean[]>(() => ITEMS.map(() => false));
  const [bursts, setBursts] = useState<Record<number, number>>({});

  const count = checked.filter(Boolean).length;
  const allDone = count === ITEMS.length;

  function toggle(i: number) {
    const next = !checked[i];
    setChecked((c) => c.map((v, j) => (j === i ? next : v)));
    if (next) setBursts((b) => ({ ...b, [i]: (b[i] ?? 0) + 1 }));
  }

  return (
    <div className="rounded-[28px] border border-forest/10 bg-white p-6 shadow-[0_20px_60px_-25px_rgb(7_53_42/0.35)] sm:p-8">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="font-display text-2xl font-bold text-forest">Your first board</h3>
        <span className="text-sm font-semibold text-forest/60 tabular-nums">
          {count} / {ITEMS.length} done
        </span>
      </div>

      <ul className="space-y-3">
        {ITEMS.map((text, i) => (
          <li key={text}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={checked[i]}
              className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${
                checked[i] ? "border-leaf/30 bg-mint" : "border-forest/10 bg-cream hover:border-leaf/40"
              }`}
            >
              <span className="relative">
                <CheckBox done={checked[i]} size={28} />
                {checked[i] && bursts[i] ? <ConfettiBurst key={bursts[i]} /> : null}
              </span>
              <span
                className="gb-strike text-base font-medium text-forest"
                data-done={checked[i] || undefined}
              >
                {text}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-mint">
        <div
          className="h-full rounded-full bg-gradient-to-r from-leaf via-zest to-sunny transition-[width] duration-700 ease-out"
          style={{ width: `${(count / ITEMS.length) * 100}%` }}
        />
      </div>

      <p
        className={`mt-4 text-center font-display text-lg font-bold transition-all duration-500 ${
          allDone ? "translate-y-0 text-leaf opacity-100" : "translate-y-2 opacity-0"
        }`}
        aria-live="polite"
      >
        {allDone ? "That's a green board. Imagine your whole week like this. 🌿" : " "}
      </p>
    </div>
  );
}
