"use client";

import { useEffect, useState } from "react";
import { CheckBox, ConfettiBurst } from "./check-box";

const TASKS = [
  { text: "Morning stand-up notes", tag: "Team", tagClass: "bg-skyblue/15 text-[#0b6aa8]" },
  { text: "Review the Q4 roadmap", tag: "Work", tagClass: "bg-grape/15 text-[#5b2fd1]" },
  { text: "Send invoice to client", tag: "Admin", tagClass: "bg-sunny/25 text-[#8a5a00]" },
  { text: "30-minute run", tag: "Health", tagClass: "bg-coral/15 text-[#c23a22]" },
  { text: "Water the plants 🌱", tag: "Home", tagClass: "bg-iris/15 text-[#3550c9]" },
];

/** Self-playing task board: ticks tasks one by one, celebrates, then resets. */
export function HeroBoard() {
  const [done, setDone] = useState(0);
  const total = TASKS.length;
  const complete = done === total;

  useEffect(() => {
    const delay = complete ? 2800 : done === 0 ? 1200 : 1050;
    const id = setTimeout(() => setDone((d) => (d >= total ? 0 : d + 1)), delay);
    return () => clearTimeout(id);
  }, [done, complete, total]);

  const pct = Math.round((done / total) * 100);
  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative w-full max-w-md">
      {/* floating chips */}
      <div
        className="gb-float absolute -left-8 -top-6 z-20 hidden rounded-2xl bg-coral px-3 py-2 text-sm font-semibold text-white shadow-lg sm:block"
        style={{ "--rot": "-6deg" } as React.CSSProperties}
      >
        🔥 12-day streak
      </div>
      <div
        className="gb-float absolute -right-5 bottom-16 z-20 hidden rounded-2xl bg-skyblue px-3 py-2 text-sm font-semibold text-white shadow-lg sm:block"
        style={{ "--rot": "5deg", animationDelay: "-3s" } as React.CSSProperties}
      >
        👥 Team synced
      </div>

      <div className="relative rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_30px_80px_-20px_rgb(46_51_73/0.35)] sm:rotate-[1.5deg]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink/50">
              Today
            </p>
            <h3 className="font-display text-2xl font-bold text-ink">My board</h3>
          </div>

          <div className="relative grid size-14 place-items-center">
            <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
              <circle cx="28" cy="28" r={R} fill="none" stroke="#eef2ff" strokeWidth="6" />
              <circle
                cx="28"
                cy="28"
                r={R}
                fill="none"
                stroke="#4f6bed"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (C * pct) / 100}
                style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2,0.7,0.2,1)" }}
              />
            </svg>
            <span className="text-xs font-bold text-ink tabular-nums">{pct}%</span>
          </div>
        </div>

        <ul className="space-y-2.5">
          {TASKS.map((t, i) => {
            const isDone = i < done;
            return (
              <li
                key={t.text}
                className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors duration-500 ${
                  isDone ? "border-iris/30 bg-mist" : "border-ink/10 bg-paper"
                }`}
              >
                <CheckBox done={isDone} />
                <span className="flex-1">
                  <span
                    className="gb-strike text-[15px] font-medium text-ink"
                    data-done={isDone || undefined}
                  >
                    {t.text}
                  </span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.tagClass}`}>
                  {t.tag}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-mist">
          <div
            className="h-full rounded-full bg-gradient-to-r from-iris to-peach transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {complete && (
          <div className="absolute inset-x-0 -bottom-5 flex justify-center">
            <div className="gb-pop relative rounded-full bg-ink px-5 py-2 text-sm font-bold text-peach shadow-xl">
              <ConfettiBurst />
              All done! Board is clear 🎉
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
