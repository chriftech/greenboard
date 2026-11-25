"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CircleAlert, Eye, EyeOff, Info, LayoutDashboard, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { AuthActionError, TwoFactorRequiredError, authActions, useAuth, type AuthUser } from "@/lib/auth";
import { UserAvatar } from "./user-avatar";
import { TwoFactorCodeForm } from "./two-factor-code";

/*
 * Login and signup forms, backed by Firebase Auth (email and password, or Google).
 * If Firebase isn't configured, the forms still validate, then explain that
 * accounts aren't set up yet. Guest mode is always one click away.
 */

type Mode = "login" | "signup";
type Field = "name" | "email" | "password";
type Errors = Partial<Record<Field, string>>;
type Status = "idle" | "working" | "google" | "unavailable";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

function validate(mode: Mode, values: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (mode === "signup" && !values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL.test(values.email.trim())) errors.email = "That doesn't look like an email address.";
  if (!values.password) errors.password = "Enter your password.";
  else if (mode === "signup" && values.password.length < MIN_PASSWORD)
    errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  return errors;
}

/** 0–4: length, mixed case, a number, a symbol. */
function strength(password: string) {
  if (!password) return 0;
  let score = password.length >= MIN_PASSWORD ? 1 : 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}
const STRENGTH = [
  { label: "Too short", color: "bg-coral" },
  { label: "Weak", color: "bg-coral" },
  { label: "Fair", color: "bg-sunny" },
  { label: "Good", color: "bg-skyblue" },
  { label: "Strong", color: "bg-success" },
];

export function AuthForm({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  // A problem that isn't about one field (network, too many attempts, Google window closed…).
  const [formError, setFormError] = useState<string | null>(null);
  // Forgot password: the link being requested, or sent; or a note when there's nothing to reset.
  const [reset, setReset] = useState<{ state: "sending" | "sent" | "unavailable"; email: string } | null>(null);
  // Two-factor sign-in: the password (or Google) step worked, and now the app's code is needed.
  const [needsCode, setNeedsCode] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const signup = mode === "signup";
  const busy = status === "working" || status === "google";
  const unavailable = auth.status === "unavailable";

  const focusField = (field: Field) => ({ name: nameRef, email: emailRef, password: passwordRef })[field].current?.focus();

  const set = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Once a field has been left (or the form submitted), keep its error up to date as you type.
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validate(mode, next)[field] }));
    if (status === "unavailable") setStatus("idle");
    setFormError(null);
  };

  const blur = (field: Field) => {
    if (!values[field]) return; // don't nag about a field just tabbed past
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(mode, values)[field] }));
  };

  /** Show an auth failure: on its field when it has one, else above the button. */
  function fail(error: unknown) {
    if (error instanceof TwoFactorRequiredError) {
      setNeedsCode(true);
      setStatus("idle");
      return;
    }
    const err = error instanceof AuthActionError ? error : new AuthActionError("Something went wrong. Please try again.");
    const field = err.field && (err.field !== "name" || signup) ? err.field : null;
    if (field) {
      setErrors((e) => ({ ...e, [field]: err.message }));
      setTouched((t) => ({ ...t, [field]: true }));
      focusField(field);
    } else setFormError(err.message);
    setStatus("idle");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found = validate(mode, values);
    setErrors(found);
    setTouched({ name: true, email: true, password: true });
    setFormError(null);
    const first = (["name", "email", "password"] as Field[]).find((f) => found[f]);
    if (first) {
      focusField(first);
      return;
    }
    setStatus("working");
    if (unavailable) {
      // Nothing to sign in to: a short pause, then the "not set up yet" note.
      window.setTimeout(() => setStatus("unavailable"), 500);
      return;
    }
    try {
      if (signup) await authActions.signUp(values.name, values.email, values.password);
      else await authActions.logIn(values.email, values.password);
      router.push("/board");
    } catch (error) {
      fail(error);
    }
  }

  async function google() {
    if (busy) return;
    setFormError(null);
    setStatus("google");
    try {
      await authActions.logInWithGoogle();
      router.push("/board");
    } catch (error) {
      fail(error);
    }
  }

  async function forgotPassword() {
    setFormError(null);
    const email = values.email.trim();
    if (!EMAIL.test(email)) {
      setTouched((t) => ({ ...t, email: true }));
      setErrors((e) => ({
        ...e,
        email: email ? "That doesn't look like an email address." : "Enter your email first, then we'll send a reset link.",
      }));
      focusField("email");
      return;
    }
    if (unavailable) return setReset({ state: "unavailable", email });
    setReset({ state: "sending", email });
    try {
      await authActions.resetPassword(email);
      setReset({ state: "sent", email });
    } catch (error) {
      setReset(null);
      fail(error);
    }
  }

  // Already signed in (and not mid-submit, which moves on to the board by itself).
  if (auth.status === "signed-in" && !busy && !needsCode) return <SignedIn user={auth.user} />;

  if (needsCode)
    return (
      <TwoFactorStep
        onDone={() => router.push("/board")}
        onCancel={() => {
          authActions.cancelTwoFactor();
          setNeedsCode(false);
        }}
      />
    );

  const score = strength(values.password);

  return (
    <div>
      <form onSubmit={submit} noValidate className="space-y-4">
        {signup && (
          <TextField
            label="Name"
            inputRef={nameRef}
            value={values.name}
            onChange={(v) => set("name", v)}
            onBlur={() => blur("name")}
            error={errors.name}
            autoComplete="name"
            placeholder="Your name"
            maxLength={60}
          />
        )}
        <TextField
          label="Email"
          type="email"
          inputRef={emailRef}
          value={values.email}
          onChange={(v) => set("email", v)}
          onBlur={() => blur("email")}
          error={errors.email}
          autoComplete="email"
          placeholder="you@example.com"
          inputMode="email"
          maxLength={120}
        />
        <TextField
          label="Password"
          type={showPassword ? "text" : "password"}
          inputRef={passwordRef}
          value={values.password}
          onChange={(v) => set("password", v)}
          onBlur={() => blur("password")}
          error={errors.password}
          autoComplete={signup ? "new-password" : "current-password"}
          placeholder={signup ? `At least ${MIN_PASSWORD} characters` : "Your password"}
          maxLength={128}
          labelAside={
            !signup && (
              <button
                type="button"
                onClick={forgotPassword}
                disabled={reset?.state === "sending"}
                className="inline-flex items-center gap-1 text-xs font-semibold text-iris underline-offset-4 hover:underline disabled:opacity-60"
              >
                {reset?.state === "sending" && <Loader2 className="size-3 animate-spin" />}
                Forgot password?
              </button>
            )
          }
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="grid size-9 place-items-center rounded-lg text-ink/45 transition-colors hover:bg-mist hover:text-ink"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
          hint={
            signup && values.password ? (
              <span className="flex items-center gap-2" aria-live="polite">
                <span aria-hidden className="flex flex-1 gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? STRENGTH[score].color : "bg-ink/10"}`}
                    />
                  ))}
                </span>
                <span className="w-16 text-right text-xs font-semibold text-ink/55">{STRENGTH[score].label}</span>
              </span>
            ) : null
          }
        />

        <div aria-live="polite" className="space-y-4 empty:hidden">
          {reset?.state === "sent" && (
            <Note>
              If there&rsquo;s an account for <b className="font-semibold text-ink">{reset.email}</b>, a link to reset your
              password is on its way. Check your inbox (and spam).
            </Note>
          )}
          {reset?.state === "unavailable" && (
            <Note>Password resets arrive with accounts. For now there&rsquo;s nothing to reset: guest mode needs no password.</Note>
          )}
          {formError && <Note tone="error">{formError}</Note>}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="gb-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-deep px-4 py-3 text-sm font-semibold text-on-deep transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
        >
          {status === "working" && <Loader2 className="size-4 animate-spin" />}
          {signup ? "Create account" : "Log in"}
        </button>

        <div aria-live="polite">
          {status === "unavailable" && (
            <Note tone="peach">
              <b className="font-semibold text-ink">Accounts aren&rsquo;t set up yet.</b> Nothing was sent or saved. Until
              then, your board works in guest mode, with everything kept in this browser.
            </Note>
          )}
        </div>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-ink/35">
        <span className="h-px flex-1 bg-ink/10" />
        or
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <div className="space-y-3">
        {!unavailable && (
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/15 bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-70"
          >
            {status === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
            Continue with Google
          </button>
        )}

        <Link
          href="/board"
          className={`group flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
            status === "unavailable" ? "border-iris bg-iris/10 text-ink" : "border-ink/15 text-ink/80 hover:border-ink/30 hover:text-ink"
          }`}
        >
          <UserRound className="size-4" />
          Continue as guest
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <p className="mt-2 text-center text-xs text-ink/45">No account needed. Your tasks stay in this browser.</p>

      <p className="mt-8 text-center text-sm text-ink/60">
        {signup ? "Already have an account? " : "New to greenboard? "}
        <Link href={signup ? "/login" : "/signup"} className="font-semibold text-iris underline-offset-4 hover:underline">
          {signup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

/** The second sign-in step when two-factor sign-in is on: the code from the authenticator app. */
function TwoFactorStep({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="gb-rise space-y-5" style={{ animationDuration: "0.35s" }}>
      <div className="flex items-start gap-3 rounded-2xl bg-mist px-4 py-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-iris/15 text-iris">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Two-factor sign-in</p>
          <p className="mt-0.5 text-sm text-ink/65">Open your authenticator app and enter the 6-digit code for greenboard.</p>
        </div>
      </div>
      <TwoFactorCodeForm
        submitLabel="Verify and log in"
        error={error}
        onSubmit={async (code) => {
          setError(null);
          try {
            await authActions.completeTwoFactor(code);
            onDone();
          } catch (e) {
            setError(e instanceof AuthActionError ? e.message : "Something went wrong. Please try again.");
          }
        }}
        extra={
          <button type="button" onClick={onCancel} className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink">
            Back
          </button>
        }
      />
    </div>
  );
}

/** Shown on the login and signup pages when you're already signed in. */
function SignedIn({ user }: { user: AuthUser }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="gb-rise space-y-4" style={{ animationDuration: "0.35s" }}>
      <div className="flex items-center gap-3 rounded-2xl bg-mist px-4 py-3.5">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <p className="text-sm text-ink/60">You&rsquo;re logged in as</p>
          <p className="truncate font-semibold">{user.name || user.email}</p>
        </div>
      </div>
      <Link
        href="/board"
        className="gb-shine flex w-full items-center justify-center gap-2 rounded-xl bg-deep px-4 py-3 text-sm font-semibold text-on-deep transition-transform hover:-translate-y-0.5"
      >
        <LayoutDashboard className="size-4" />
        Go to your board
      </Link>
      <button
        type="button"
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          await authActions.logOut().catch(() => {});
          setLeaving(false);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/15 px-4 py-3 text-sm font-semibold text-ink/80 transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-70"
      >
        {leaving ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        Log out
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  error,
  inputRef,
  trailing,
  labelAside,
  hint,
  type = "text",
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  trailing?: ReactNode;
  labelAside?: ReactNode;
  hint?: ReactNode;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "email" | "text";
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {labelAside}
      </div>
      <div
        className={`flex items-center rounded-xl border bg-paper pr-1 transition-colors focus-within:border-iris focus-within:ring-2 focus-within:ring-iris/20 ${
          error ? "border-coral" : "border-ink/15"
        }`}
      >
        <input
          id={id}
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm placeholder:text-ink/35 focus:outline-none"
          {...rest}
        />
        {trailing}
      </div>
      {hint && <div className="mt-2">{hint}</div>}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

function Note({ children, tone = "mist" }: { children: ReactNode; tone?: "mist" | "peach" | "error" }) {
  const tones = { mist: "bg-mist", peach: "bg-peach/25", error: "bg-coral/10 text-ink/80" };
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={`gb-rise flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm text-ink/70 ${tones[tone]}`}
      style={{ animationDuration: "0.35s" }}
    >
      {tone === "error" ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-coral" />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-iris" />
      )}
      <span>{children}</span>
    </p>
  );
}
