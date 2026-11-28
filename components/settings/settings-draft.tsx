"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { setSettings, useSettings, type Settings } from "@/lib/settings";
import { useHydrated } from "@/lib/hydrated";

/**
 * A section's settings as a draft: changes show in the form but are only saved
 * (and only apply to the board) when the section's Save button is pressed.
 */
export function useSettingsDraft<K extends keyof Settings>(keys: readonly K[]) {
  const saved = useSettings();
  const [draft, setDraft] = useState<Partial<Pick<Settings, K>>>({});
  const [justSaved, setJustSaved] = useState(false);

  const value = Object.fromEntries(keys.map((k) => [k, k in draft ? draft[k] : saved[k]])) as Pick<Settings, K>;
  const dirty = keys.some((k) => k in draft && draft[k] !== saved[k]);

  // Leaving or reloading the page with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [justSaved]);

  return {
    value,
    dirty,
    justSaved,
    set<P extends K>(key: P, next: Settings[P]) {
      setJustSaved(false);
      setDraft((d) => ({ ...d, [key]: next }));
    },
    save() {
      setSettings(value);
      setDraft({});
      setJustSaved(true);
    },
    discard() {
      setDraft({});
    },
  };
}

/** The footer of a settings section: what's changed, and Discard / Save. */
export function SaveBar({
  dirty,
  justSaved,
  onSave,
  onDiscard,
  busy = false,
}: {
  dirty: boolean;
  justSaved: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** Something is still being decided (e.g. the browser asking for permission). */
  busy?: boolean;
}) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 bg-paper/50 px-5 py-3.5">
      <p aria-live="polite" className="min-w-0 flex-1 text-sm">
        {dirty ? (
          <span className="font-medium text-ink/70">You have unsaved changes.</span>
        ) : justSaved ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <Check className="size-4" />
            Saved
          </span>
        ) : null}
      </p>
      <div className="flex gap-2">
        {dirty && (
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50"
          >
            Discard
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-on-deep transition-opacity disabled:opacity-40"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}
