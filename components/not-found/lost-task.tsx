"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckBox, ConfettiBurst } from "@/components/landing/check-box";

// The page is built ahead of time, so the missing address is only known in the browser.
const noSubscribe = () => () => {};
function browserPath() {
  const path = window.location.pathname;
  try {
    return decodeURI(path);
  } catch {
    return path; // a malformed address, e.g. a stray "%"
  }
}
const noPath = () => "";

/**
 * The 404 page's task card: "Find <the missing path>". Ticking it celebrates,
 * since the visitor has, in a way, found where they are.
 */
export function LostTask() {
  const pathname = useSyncExternalStore(noSubscribe, browserPath, noPath);
  const [found, setFound] = useState(false);

  return (
    <div className="relative w-full max-w-md">
      <div
        className="gb-float absolute -right-3 -top-5 z-10 rounded-2xl bg-coral px-3 py-1.5 text-xs font-semibold text-white shadow-lg sm:-right-6"
        style={{ "--rot": "6deg" } as React.CSSProperties}
      >
        Off the board
      </div>

      <div className="relative rounded-[24px] border border-ink/10 bg-surface p-4 shadow-[0_30px_80px_-30px_rgb(46_51_73/0.45)] sm:-rotate-1 sm:p-5">
        <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-ink/45">
          {found ? "Completed · 1" : "Pending · 1"}
        </p>

        <button
          type="button"
          onClick={() => setFound((f) => !f)}
          aria-pressed={found}
          className={`relative flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors duration-500 ${
            found ? "border-success/30 bg-success-soft" : "border-ink/10 bg-paper hover:border-ink/25"
          }`}
        >
          <span className="relative">
            <CheckBox done={found} />
            {found && <ConfettiBurst />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="gb-strike text-[15px] font-medium text-ink" data-done={found || undefined}>
              Find this page
            </span>
            <span className="mt-0.5 block truncate font-mono text-xs text-ink/50" title={pathname}>
              {pathname || "\u00a0"}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-[#c23a22] dark:text-[#ffab9c]">
            404
          </span>
        </button>

        <p aria-live="polite" className="mt-3 min-h-5 px-1 text-sm text-ink/55">
          {found ? "Ticked off. Now let's go somewhere that exists." : "Go on, tick it off anyway."}
        </p>
      </div>
    </div>
  );
}
