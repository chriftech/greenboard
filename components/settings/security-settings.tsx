"use client";

import { useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import type { TotpSecret } from "firebase/auth";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { authActions, useAuth, type AuthUser } from "@/lib/auth";
import { TwoFactorCodeForm } from "@/components/auth/two-factor-code";
import { ProfileSkeleton } from "./settings-skeleton";
import { Row, card, message } from "./profile-settings";

/** Signing in safely: the password, and two-factor sign-in with an authenticator app. */
export function SecuritySettings() {
  const auth = useAuth();

  return (
    <section aria-labelledby="security-settings" className="gb-rise" style={{ animationDelay: "60ms" }}>
      <h2 id="security-settings" className="px-1 text-xs font-semibold uppercase tracking-widest text-ink/50">
        Security
      </h2>

      {auth.status === "loading" ? (
        <ProfileSkeleton />
      ) : auth.status === "signed-in" ? (
        <div className={card}>
          {auth.user.providers.includes("password") && auth.user.email && <PasswordRow email={auth.user.email} />}
          <TwoFactorRow key={auth.user.uid} user={auth.user} />
        </div>
      ) : (
        <div className={card}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mist text-iris">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Nothing to secure yet</p>
              <p className="mt-0.5 text-sm text-ink/60">
                {auth.status === "unavailable"
                  ? "Accounts aren’t set up yet. Your board is kept in this browser."
                  : "Log in to manage your password and two-factor sign-in."}
              </p>
            </div>
            {auth.status === "signed-out" && (
              <Link
                href="/login"
                className="self-start rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-on-deep transition-transform hover:-translate-y-0.5 sm:self-auto"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PasswordRow({ email }: { email: string }) {
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; text: string }>({
    kind: "idle",
  });

  async function send() {
    setState({ kind: "sending" });
    try {
      await authActions.resetPassword(email);
      setState({ kind: "sent" });
    } catch (error) {
      setState({ kind: "error", text: message(error) });
    }
  }

  return (
    <Row icon={<KeyRound className="size-4" />} title="Password">
      <p className="mt-0.5 text-sm text-ink/60">We&rsquo;ll email you a link to choose a new password.</p>
      <button
        type="button"
        onClick={send}
        disabled={state.kind === "sending" || state.kind === "sent"}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-ink/15 px-3.5 py-2 text-sm font-semibold transition-colors hover:border-ink/30 disabled:opacity-60"
      >
        {state.kind === "sending" && <Loader2 className="size-4 animate-spin" />}
        {state.kind === "sent" ? "Link sent" : "Send password reset link"}
      </button>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm">
        {state.kind === "sent" && <span className="text-success">Sent to {email}.</span>}
        {state.kind === "error" && <span className="text-coral">{state.text}</span>}
      </p>
    </Row>
  );
}

/** A secret being set up: shown as a QR code and as a key, until a code from the app confirms it. */
type Setup = { secret: TotpSecret; key: string; qr: string };

type TwoFactorState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "setup"; setup: Setup; error: string | null }
  | { kind: "turned-on" }
  | { kind: "confirm-off" }
  | { kind: "turning-off" }
  | { kind: "error"; text: string };

function TwoFactorRow({ user }: { user: AuthUser }) {
  const [state, setState] = useState<TwoFactorState>({ kind: "idle" });
  const on = user.twoFactor.length > 0;

  async function start() {
    setState({ kind: "starting" });
    try {
      const { secret, key, url } = await authActions.startTwoFactorSetup();
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 184, errorCorrectionLevel: "M" });
      setState({ kind: "setup", setup: { secret, key, qr }, error: null });
    } catch (error) {
      setState({ kind: "error", text: message(error) });
    }
  }

  async function turnOff() {
    setState({ kind: "turning-off" });
    try {
      for (const f of user.twoFactor) await authActions.removeTwoFactor(f.uid);
      setState({ kind: "idle" });
    } catch (error) {
      setState({ kind: "error", text: message(error) });
    }
  }

  return (
    <Row icon={on ? <ShieldCheck className="size-4" /> : <Smartphone className="size-4" />} title="Two-factor sign-in">
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink/60">
        <span>After your password, ask for a code from an authenticator app.</span>
        {on ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
            <ShieldCheck className="size-3.5" />
            On
          </span>
        ) : (
          <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold text-ink/55">Off</span>
        )}
      </p>

      {on ? (
        <>
          <ul className="mt-3 space-y-2">
            {user.twoFactor.map((f) => (
              <li key={f.uid} className="flex items-center gap-3 rounded-xl bg-mist px-3.5 py-2.5 text-sm">
                <Smartphone className="size-4 shrink-0 text-iris" />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <span className="shrink-0 text-xs text-ink/50">Added {new Date(f.addedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
          {state.kind === "turned-on" && (
            <p className="mt-3 text-sm text-success">Two-factor sign-in is on. You&rsquo;ll be asked for a code next time you log in.</p>
          )}
          {state.kind === "confirm-off" || state.kind === "turning-off" ? (
            <div className="mt-3 rounded-xl border border-coral/30 bg-coral/5 p-3.5">
              <p className="text-sm font-medium">Turn off two-factor sign-in?</p>
              <p className="mt-0.5 text-sm text-ink/60">Logging in will only need your password again.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={turnOff}
                  disabled={state.kind === "turning-off"}
                  className="inline-flex items-center gap-2 rounded-xl bg-coral px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {state.kind === "turning-off" && <Loader2 className="size-4 animate-spin" />}
                  Turn off
                </button>
                <button
                  type="button"
                  onClick={() => setState({ kind: "idle" })}
                  disabled={state.kind === "turning-off"}
                  className="rounded-xl px-3.5 py-2 text-sm font-semibold text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  Keep it on
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setState({ kind: "confirm-off" })}
              className="mt-3 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-coral transition-colors hover:bg-coral/10"
            >
              <ShieldOff className="size-4" />
              Turn off two-factor sign-in
            </button>
          )}
        </>
      ) : state.kind === "setup" ? (
        <SetupSteps
          setup={state.setup}
          error={state.error}
          onCancel={() => setState({ kind: "idle" })}
          onCode={async (code) => {
            try {
              await authActions.finishTwoFactorSetup(state.setup.secret, code);
              setState({ kind: "turned-on" });
            } catch (error) {
              setState({ ...state, error: message(error) });
            }
          }}
        />
      ) : !user.emailVerified ? (
        <p className="mt-3 rounded-xl bg-sunny/20 px-3.5 py-2.5 text-sm text-ink/70">
          Confirm your email address first (see the Account tab), then come back to turn this on.
        </p>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={state.kind === "starting"}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-deep px-3.5 py-2 text-sm font-semibold text-on-deep transition-opacity disabled:opacity-60"
        >
          {state.kind === "starting" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Set up an authenticator app
        </button>
      )}

      {state.kind === "error" && (
        <p role="alert" className="mt-2 text-sm text-coral">
          {state.text}
        </p>
      )}
    </Row>
  );
}

function SetupSteps({
  setup,
  error,
  onCode,
  onCancel,
}: {
  setup: Setup;
  error: string | null;
  onCode: (code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // The key in groups of four, easier to read and type.
  const grouped = setup.key.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="mt-4 space-y-5 rounded-2xl border border-ink/10 bg-paper p-4 sm:p-5">
      <Step n={1} title="Scan this QR code">
        <p className="text-sm text-ink/60">
          Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a file to optimise */}
          <img
            src={setup.qr}
            alt="QR code to add greenboard to your authenticator app"
            width={184}
            height={184}
            className="rounded-xl border border-ink/10 bg-white p-1.5"
          />
          <div className="min-w-0 text-sm">
            <p className="text-ink/60">Can&rsquo;t scan it? Type this key into the app instead:</p>
            <p className="mt-1.5 break-all font-mono text-sm font-semibold tracking-wider">{grouped}</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(setup.key)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => {});
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-iris transition-colors hover:bg-iris/10"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
        </div>
      </Step>

      <Step n={2} title="Enter the code it shows">
        <div className="max-w-xs">
          <TwoFactorCodeForm
            submitLabel="Turn on"
            error={error}
            autoFocus={false}
            onSubmit={onCode}
            extra={
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                Cancel
              </button>
            }
          />
        </div>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-iris text-xs font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
