"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, Info, Loader2, UserRound } from "lucide-react";

/*
 * Login and signup forms. There are no accounts yet: the forms validate what's
 * typed, then explain that accounts are coming soon. Nothing is sent or stored
 * (passwords included), and guest mode is always one click away.
 */

type Mode = "login" | "signup";
type Field = "name" | "email" | "password";
type Errors = Partial<Record<Field, string>>;

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
  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "soon">("idle");
  const [forgot, setForgot] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const set = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Once a field has been left (or the form submitted), keep its error up to date as you type.
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validate(mode, next)[field] }));
    if (status === "soon") setStatus("idle");
  };

  const blur = (field: Field) => {
    if (!values[field]) return; // don't nag about a field just tabbed past
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(mode, values)[field] }));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate(mode, values);
    setErrors(found);
    setTouched({ name: true, email: true, password: true });
    const first = (["name", "email", "password"] as Field[]).find((f) => found[f]);
    if (first) {
      ({ name: nameRef, email: emailRef, password: passwordRef })[first].current?.focus();
      return;
    }
    // Nothing is sent anywhere: a short pause, then the "coming soon" note.
    setStatus("checking");
    window.setTimeout(() => setStatus("soon"), 500);
  }

  const score = strength(values.password);
  const signup = mode === "signup";

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
                onClick={() => setForgot((f) => !f)}
                aria-expanded={forgot}
                className="text-xs font-semibold text-iris underline-offset-4 hover:underline"
              >
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

        {!signup && forgot && (
          <Note>Password resets arrive with accounts. For now there&rsquo;s nothing to reset: guest mode needs no password.</Note>
        )}

        <button
          type="submit"
          disabled={status === "checking"}
          className="gb-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-deep px-4 py-3 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
        >
          {status === "checking" && <Loader2 className="size-4 animate-spin" />}
          {signup ? "Create account" : "Log in"}
        </button>

        <div aria-live="polite">
          {status === "soon" && (
            <Note tone="peach">
              <b className="font-semibold text-ink">Accounts are coming soon.</b> Nothing was sent or saved. Until then,
              your board works in guest mode, with everything kept in this browser.
            </Note>
          )}
        </div>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-ink/35">
        <span className="h-px flex-1 bg-ink/10" />
        or
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <Link
        href="/board"
        className={`group flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
          status === "soon" ? "border-iris bg-iris/10 text-ink" : "border-ink/15 text-ink/80 hover:border-ink/30 hover:text-ink"
        }`}
      >
        <UserRound className="size-4" />
        Continue as guest
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
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

function Note({ children, tone = "mist" }: { children: ReactNode; tone?: "mist" | "peach" }) {
  return (
    <p
      className={`gb-rise flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm text-ink/70 ${
        tone === "peach" ? "bg-peach/25" : "bg-mist"
      }`}
      style={{ animationDuration: "0.35s" }}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-iris" />
      <span>{children}</span>
    </p>
  );
}
