"use client";

import { useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Columns3, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";

const TABS = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "board", label: "Board", icon: LayoutDashboard },
  { id: "columns", label: "Columns", icon: Columns3 },
] as const;

export type SettingsTab = (typeof TABS)[number]["id"];

/* The open tab lives in the URL's hash (/settings#security), so it can be linked to and survives a reload. */
const CHANGE = "gb-settings-tab";
const isTab = (v: string): v is SettingsTab => TABS.some((t) => t.id === v);
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}
const current = (): SettingsTab => {
  const hash = window.location.hash.slice(1);
  return isTab(hash) ? hash : "account";
};
function open(tab: SettingsTab) {
  // Replace rather than push, so Back leaves Settings instead of stepping through tabs.
  window.history.replaceState(null, "", `#${tab}`);
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Settings, split into tabs: a segmented bar like the board's filters, with one
 * panel per tab. Panels that aren't open stay mounted (hidden), so half-typed
 * changes survive switching tabs.
 */
export function SettingsTabs({ panels }: { panels: Record<SettingsTab, ReactNode> }) {
  const tab = useSyncExternalStore(subscribe, current, () => "account" as SettingsTab);
  const refs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  // Arrow keys, Home and End move between tabs, as in any tab list.
  function onKeyDown(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === "ArrowRight" ? (i + 1) % TABS.length
      : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : -1;
    if (next === -1) return;
    e.preventDefault();
    open(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  }

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Settings sections"
        onKeyDown={onKeyDown}
        className="grid grid-cols-4 gap-1 rounded-2xl bg-ink/[0.06] p-1 sm:inline-grid sm:min-w-[32rem]"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={active}
              aria-controls={`settings-panel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => open(id)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                active ? "bg-surface text-ink shadow-[0_2px_8px_-3px_rgb(46_51_73/0.35)]" : "text-ink/60 hover:text-ink"
              }`}
            >
              <Icon className={`size-4 shrink-0 ${active ? "text-iris" : ""}`} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {TABS.map(({ id }) => (
        <div
          key={id}
          role="tabpanel"
          id={`settings-panel-${id}`}
          aria-labelledby={`settings-tab-${id}`}
          hidden={tab !== id}
          className="mt-8 space-y-10"
        >
          {panels[id]}
        </div>
      ))}
    </div>
  );
}
