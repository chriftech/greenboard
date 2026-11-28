"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, Loader2, LogOut, Mail, MailWarning, RefreshCw, UserRound } from "lucide-react";
import { AuthActionError, authActions, useAuth, type AuthUser } from "@/lib/auth";
import { UserAvatar } from "@/components/auth/user-avatar";
import { ProfileSkeleton } from "./settings-skeleton";

const MAX_NAME = 50;

export const card =
  "mt-3 divide-y divide-ink/10 overflow-hidden rounded-[24px] border border-ink/10 bg-surface shadow-[0_20px_60px_-30px_rgb(46_51_73/0.4)]";

/** The signed-in account: name, email and its verification, and sign-in method. Password and 2FA are under Security. */
export function ProfileSettings() {
  const auth = useAuth();

  return (
    <section aria-labelledby="profile-settings" className="gb-rise" style={{ animationDelay: "60ms" }}>
      <h2 id="profile-settings" className="px-1 text-xs font-semibold uppercase tracking-widest text-ink/50">
        Profile
      </h2>

      {auth.status === "loading" ? (
        <ProfileSkeleton />
      ) : auth.status === "signed-in" ? (
        <SignedInProfile key={auth.user.uid} user={auth.user} />
      ) : (
        <div className={card}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mist text-iris">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">You&rsquo;re using greenboard as a guest</p>
              <p className="mt-0.5 text-sm text-ink/60">
                {auth.status === "unavailable"
                  ? "Accounts aren’t set up yet, so there’s no profile to edit. Your board is kept in this browser."
                  : "Log in or sign up to set your name and manage your account."}
              </p>
            </div>
            {auth.status === "signed-out" && (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-semibold transition-colors hover:border-ink/30"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-on-deep transition-transform hover:-translate-y-0.5"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SignedInProfile({ user }: { user: AuthUser }) {
  const hasPassword = user.providers.includes("password");
  const hasGoogle = user.providers.includes("google.com");
  const method = [hasGoogle && "Google", hasPassword && "Email and password"].filter(Boolean).join(" and ");

  return (
    <div className={card}>
      {/* Who's signed in */}
      <div className="flex items-center gap-4 p-5">
        <UserAvatar user={user} className="size-14 text-xl" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{user.name || "No name yet"}</p>
          <p className="truncate text-sm text-ink/60">{user.email}</p>
          {method && <p className="mt-0.5 text-xs text-ink/45">Signs in with {method}</p>}
        </div>
      </div>

      <NameRow user={user} />
      {user.email && <EmailRow user={user} />}

      <div className="flex items-center justify-between gap-4 p-5">
        <p className="text-sm text-ink/60">Your tasks stay in this browser after you log out.</p>
        <LogOutButton />
      </div>
    </div>
  );
}

export function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mist text-iris">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

export const message = (error: unknown) =>
  error instanceof AuthActionError ? error.message : "Something went wrong. Please try again.";

function NameRow({ user }: { user: AuthUser }) {
  const [name, setName] = useState(user.name ?? "");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; text: string }>({
    kind: "idle",
  });
  const trimmed = name.trim();
  const unchanged = trimmed === (user.name ?? "").trim();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (unchanged || !trimmed || state.kind === "saving") return;
    setState({ kind: "saving" });
    try {
      await authActions.updateName(trimmed);
      setState({ kind: "saved" });
    } catch (error) {
      setState({ kind: "error", text: message(error) });
    }
  }

  return (
    <Row icon={<UserRound className="size-4" />} title="Name">
      <p className="mt-0.5 text-sm text-ink/60">Shown in the profile menu and the sidebar.</p>
      <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="profile-name" className="sr-only">
          Your name
        </label>
        <input
          id="profile-name"
          value={name}
          maxLength={MAX_NAME}
          autoComplete="name"
          onChange={(e) => {
            setName(e.target.value);
            if (state.kind !== "saving") setState({ kind: "idle" });
          }}
          aria-invalid={state.kind === "error" || undefined}
          aria-describedby="profile-name-status"
          className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-iris"
        />
        <button
          type="submit"
          disabled={unchanged || !trimmed || state.kind === "saving"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-deep px-4 py-2.5 text-sm font-semibold text-on-deep transition-opacity disabled:opacity-50"
        >
          {state.kind === "saving" && <Loader2 className="size-4 animate-spin" />}
          Save
        </button>
      </form>
      <p id="profile-name-status" aria-live="polite" className="mt-2 min-h-5 text-sm">
        {state.kind === "saved" && <span className="text-success">Name saved.</span>}
        {state.kind === "error" && <span className="text-coral">{state.text}</span>}
        {state.kind === "idle" && !trimmed && <span className="text-coral">Enter your name.</span>}
      </p>
    </Row>
  );
}

function EmailRow({ user }: { user: AuthUser }) {
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" | "too-soon" | "checking" | "not-yet" } | { kind: "error"; text: string }>({
    kind: "idle",
  });
  const busy = state.kind === "sending" || state.kind === "checking";

  async function resend() {
    setState({ kind: "sending" });
    try {
      setState({ kind: await authActions.resendVerification() });
    } catch (error) {
      setState({ kind: "error", text: message(error) });
    }
  }

  async function check() {
    setState({ kind: "checking" });
    try {
      await authActions.reloadUser();
      // If it's now verified, this row re-renders with the Verified badge.
      setState({ kind: "not-yet" });
    } catch (error) {
      setState({ kind: "error", text: message(error) });
    }
  }

  return (
    <Row icon={user.emailVerified ? <Mail className="size-4" /> : <MailWarning className="size-4" />} title="Email">
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink/60">
        <span className="break-all">{user.email}</span>
        {user.emailVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
            <BadgeCheck className="size-3.5" />
            Verified
          </span>
        ) : (
          <span className="rounded-full bg-sunny/25 px-2 py-0.5 text-xs font-semibold text-[#8a5a00] dark:text-[#ffd77a]">
            Not verified
          </span>
        )}
      </p>

      {!user.emailVerified && (
        <>
          <p className="mt-2 text-sm text-ink/60">Open the link we emailed you to confirm this address.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-3.5 py-2 text-sm font-semibold transition-colors hover:border-ink/30 disabled:opacity-60"
            >
              {state.kind === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Resend email
            </button>
            <button
              type="button"
              onClick={check}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-iris transition-colors hover:bg-iris/10 disabled:opacity-60"
            >
              {state.kind === "checking" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              I&rsquo;ve confirmed it
            </button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 text-sm">
            {state.kind === "sent" && <span className="text-success">Sent. Check your inbox (and spam folder).</span>}
            {state.kind === "too-soon" && <span className="text-ink/60">We just sent one. Give it a minute before asking again.</span>}
            {state.kind === "not-yet" && <span className="text-ink/60">Not confirmed yet. Open the link in the email, then try again.</span>}
            {state.kind === "error" && <span className="text-coral">{state.text}</span>}
          </p>
        </>
      )}
    </Row>
  );
}

function LogOutButton() {
  const [leaving, setLeaving] = useState(false);
  return (
    <button
      type="button"
      disabled={leaving}
      onClick={() => {
        setLeaving(true);
        authActions.logOut().catch(() => setLeaving(false));
      }}
      className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-coral transition-colors hover:bg-coral/10 disabled:opacity-60"
    >
      {leaving ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      Log out
    </button>
  );
}
