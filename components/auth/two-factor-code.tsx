"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, Loader2 } from "lucide-react";

/**
 * The 6-digit code from an authenticator app, with its submit button. Used when
 * signing in with two-factor sign-in on, and when setting it up in Settings.
 */
export function TwoFactorCodeForm({
  submitLabel,
  onSubmit,
  error,
  extra,
  autoFocus = true,
}: {
  submitLabel: string;
  /** Resolve when the code is accepted; throw (with a message) when it isn't. */
  onSubmit: (code: string) => Promise<void>;
  /** A problem to show under the field, if any. */
  error?: string | null;
  /** Buttons shown next to the submit button (e.g. Cancel). */
  extra?: ReactNode;
  autoFocus?: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = /^\d{6}$/.test(code);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onSubmit(code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <label className="block">
        <span className="text-sm font-semibold">6-digit code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          // The code is the only thing to do on this step.
          autoFocus={autoFocus}
          placeholder="123456"
          aria-invalid={error ? true : undefined}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.5em] outline-none transition-colors placeholder:text-ink/20 focus:border-iris"
        />
      </label>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-coral">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!ready || busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-deep px-4 py-2.5 text-sm font-semibold text-on-deep transition-opacity disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </button>
        {extra}
      </div>
    </form>
  );
}
