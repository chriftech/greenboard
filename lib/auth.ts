/**
 * Who's signed in, and the actions that change it. Backed by Firebase Auth; when
 * Firebase isn't configured, the status is "unavailable" and guest mode carries on.
 *
 * Tasks still live in this browser (localStorage) whether or not you're signed in.
 */

import { useSyncExternalStore } from "react";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  TotpMultiFactorGenerator,
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  multiFactor,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { setAuthHint } from "./auth-hint";
import type { PlanId } from "./plan";

export type AuthUser = {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  /** How this account signs in: "password" (email and password) and/or "google.com". */
  providers: string[];
  /** Second factors for two-factor sign-in (authenticator apps). Empty when 2FA is off. */
  twoFactor: TwoFactorMethod[];
  /** The account's plan: "free" until a payment sets the `plan` custom claim. */
  plan: PlanId;
};

/** An enrolled second factor. */
export type TwoFactorMethod = {
  uid: string;
  /** The name given when it was added, e.g. "Authenticator app". */
  name: string;
  /** "totp" (an authenticator app) or "phone". */
  kind: string;
  /** When it was added (ISO date string). */
  addedAt: string;
};

export type AuthState =
  | { status: "loading"; user: null } // waiting for Firebase to say who's signed in
  | { status: "unavailable"; user: null } // Firebase isn't configured: guest mode only
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: AuthUser };

const LOADING: AuthState = { status: "loading", user: null };
const UNAVAILABLE: AuthState = { status: "unavailable", user: null };
const SIGNED_OUT: AuthState = { status: "signed-out", user: null };

let state: AuthState = isFirebaseConfigured() ? LOADING : UNAVAILABLE;
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  // Remember whether this browser is signed in, for pages that redirect before Firebase has answered.
  if (next.status === "signed-in" || next.status === "signed-out") setAuthHint(next.status === "signed-in");
  listeners.forEach((l) => l());
}

/** Read the `plan` custom claim; anything unpaid or unknown is Free. */
const toPlan = (value: unknown): PlanId => (value === "standard" || value === "premium" ? value : "free");

/** The account's paid plan, from its ID token's custom claims (set by the server after a payment). */
async function planOf(u: User): Promise<PlanId> {
  try {
    return toPlan((await u.getIdTokenResult()).claims.plan);
  } catch {
    // Offline or the token can't be read: the free benefits still apply.
    return "free";
  }
}

function toAuthUser(u: User, plan: PlanId): AuthUser {
  return {
    uid: u.uid,
    name: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
    emailVerified: u.emailVerified,
    providers: u.providerData.map((p) => p.providerId),
    twoFactor: multiFactor(u).enrolledFactors.map((f) => ({
      uid: f.uid,
      name: f.displayName || (f.factorId === "totp" ? "Authenticator app" : "Phone"),
      kind: f.factorId,
      addedAt: f.enrollmentTime,
    })),
    plan,
  };
}

/** Signed in as this user, once their plan is known (so limits don't flicker from Free to paid). */
async function setUser(u: User | null) {
  if (!u) return set(SIGNED_OUT);
  const plan = await planOf(u);
  // A newer sign-in or sign-out may have happened while waiting.
  if (getFirebaseAuth()?.currentUser?.uid !== u.uid) return;
  set({ status: "signed-in", user: toAuthUser(u, plan) });
}

/** Re-read the current user (needed after profile changes, which onAuthStateChanged doesn't report). */
function refresh() {
  const user = getFirebaseAuth()?.currentUser;
  // Keep the plan already known for this account; a profile change doesn't change it.
  const plan = state.status === "signed-in" && state.user.uid === user?.uid ? state.user.plan : "free";
  set(user ? { status: "signed-in", user: toAuthUser(user, plan) } : SIGNED_OUT);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Start listening to Firebase the first time anything asks who's signed in.
  if (!started) {
    started = true;
    const auth = getFirebaseAuth();
    if (auth) onAuthStateChanged(auth, (u) => void setUser(u));
  }
  return () => listeners.delete(listener);
}

/** Who's signed in right now, outside React. */
export const getAuthState = (): AuthState => state;

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

/* ───────────────────────── Errors ───────────────────────── */

export type AuthErrorField = "name" | "email" | "password";
export class AuthActionError extends Error {
  constructor(
    message: string,
    /** The form field the problem belongs to, if any. */
    public field?: AuthErrorField,
  ) {
    super(message);
  }
}

/**
 * Signing in needs a second step: the code from the user's authenticator app.
 * Finish with authActions.completeTwoFactor(code), or drop it with cancelTwoFactor().
 */
export class TwoFactorRequiredError extends AuthActionError {
  constructor() {
    super("Enter the 6-digit code from your authenticator app.");
  }
}

/** The pending two-factor sign-in, between the password (or Google) step and the code. */
let pendingTwoFactor: MultiFactorResolver | null = null;

/** If Firebase wants a second factor, keep its resolver and ask for the code instead of failing. */
function catchTwoFactor(error: unknown): never {
  const auth = getFirebaseAuth();
  if (auth && error instanceof FirebaseError && error.code === "auth/multi-factor-auth-required") {
    pendingTwoFactor = getMultiFactorResolver(auth, error as MultiFactorError);
    if (pendingTwoFactor.hints.some((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)) throw new TwoFactorRequiredError();
    pendingTwoFactor = null;
    throw new AuthActionError("This account uses a kind of two-factor sign-in greenboard doesn't support yet.");
  }
  throw error;
}

/** Firebase's error codes, in words a person can act on. */
function friendly(error: unknown): AuthActionError {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-verification-code":
    case "auth/missing-code":
      return new AuthActionError("That code didn't match. Check your authenticator app and try again.");
    case "auth/code-expired":
    case "auth/totp-challenge-timeout":
      return new AuthActionError("That took a little too long. Start again to get a fresh code.");
    case "auth/unverified-email":
      return new AuthActionError("Confirm your email address first, then turn on two-factor sign-in.");
    case "auth/admin-restricted-operation":
      return new AuthActionError("Two-factor sign-in isn't switched on for greenboard yet.");
    case "auth/maximum-second-factor-count-exceeded":
      return new AuthActionError("This account already has as many second factors as it can.");
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return new AuthActionError("That email and password don't match an account.", "password");
    case "auth/invalid-email":
      return new AuthActionError("That doesn't look like an email address.", "email");
    case "auth/email-already-in-use":
      return new AuthActionError("There's already an account with this email. Try logging in.", "email");
    case "auth/weak-password":
      return new AuthActionError("Choose a stronger password.", "password");
    case "auth/user-disabled":
      return new AuthActionError("This account has been turned off.");
    case "auth/too-many-requests":
      return new AuthActionError("Too many attempts. Wait a moment, then try again.");
    case "auth/network-request-failed":
      return new AuthActionError("Couldn't reach the server. Check your connection and try again.");
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return new AuthActionError("The Google window was closed before signing in.");
    case "auth/popup-blocked":
      return new AuthActionError("Your browser blocked the Google window. Allow pop-ups for this site and try again.");
    case "auth/account-exists-with-different-credential":
      return new AuthActionError("This email already has an account with a different sign-in method.");
    case "auth/operation-not-allowed":
      return new AuthActionError("This sign-in method isn't turned on for greenboard yet.");
    case "auth/requires-recent-login":
      return new AuthActionError("For your security, log out and back in, then try again.");
    case "auth/unauthorized-domain":
      return new AuthActionError("Sign-in isn't allowed from this address. Add it to Firebase's authorized domains.");
    default:
      return new AuthActionError("Something went wrong. Please try again.");
  }
}

function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) throw new AuthActionError("Accounts aren't set up yet. You can keep using guest mode.");
  return auth;
}

/** Runs a Firebase call, turning its errors into AuthActionErrors. */
async function attempt<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw error instanceof AuthActionError ? error : friendly(error);
  }
}

/**
 * Send the verification email: greenboard's own branded one (via the server
 * route) when that's set up, else Firebase's built-in email, so it always goes out.
 */
async function sendVerification(user: User): Promise<"sent" | "too-soon"> {
  try {
    const response = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    // Sent, or already verified: nothing more to do.
    if (response.ok) return "sent";
    // Asked again within a minute of the last one.
    if (response.status === 429) return "too-soon";
  } catch {
    // Network trouble reaching our server: fall through to Firebase's email.
  }
  await sendEmailVerification(user);
  return "sent";
}

function requireUser() {
  const user = requireAuth().currentUser;
  if (!user) throw new AuthActionError("You're signed out. Log in and try again.");
  return user;
}

/* ───────────────────────── Actions ───────────────────────── */

export const authActions = {
  /** Throws TwoFactorRequiredError when the account also needs a code from an authenticator app. */
  logIn: (email: string, password: string) =>
    attempt(async () => {
      pendingTwoFactor = null;
      await signInWithEmailAndPassword(requireAuth(), email.trim(), password).catch(catchTwoFactor);
    }),

  signUp: (name: string, email: string, password: string) =>
    attempt(async () => {
      const { user } = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      refresh(); // show the name straight away
      // Best effort: a failed verification email shouldn't undo a successful sign-up.
      sendVerification(user).catch(() => {});
    }),

  logInWithGoogle: () =>
    attempt(async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      pendingTwoFactor = null;
      await signInWithPopup(requireAuth(), provider).catch(catchTwoFactor);
    }),

  /** Finish a sign-in that needed a second factor, with the code from the authenticator app. */
  completeTwoFactor: (code: string) =>
    attempt(async () => {
      const resolver = pendingTwoFactor;
      const hint = resolver?.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      if (!resolver || !hint) throw new AuthActionError("That sign-in has expired. Enter your details again.");
      await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim()));
      pendingTwoFactor = null;
    }),

  /** Give up on a sign-in that was waiting for a second factor. */
  cancelTwoFactor: () => {
    pendingTwoFactor = null;
  },

  /**
   * Start adding an authenticator app: a secret to show as a QR code (and as a key to type in).
   * Finish with finishTwoFactorSetup and a code from the app.
   */
  startTwoFactorSetup: () =>
    attempt(async () => {
      const user = requireUser();
      const session = await multiFactor(user).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      return {
        secret,
        key: secret.secretKey,
        url: secret.generateQrCodeUrl(user.email ?? "greenboard", "Greenboard"),
      };
    }),

  /** Confirm the new authenticator app with a code from it; two-factor sign-in is on from then. */
  finishTwoFactorSetup: (secret: TotpSecret, code: string) =>
    attempt(async () => {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(requireUser()).enroll(assertion, "Authenticator app");
      refresh();
    }),

  /** Remove a second factor (turning two-factor sign-in off when it was the only one). */
  removeTwoFactor: (uid: string) =>
    attempt(async () => {
      await multiFactor(requireUser()).unenroll(uid);
      refresh();
    }),

  /** Firebase doesn't reveal whether the email has an account, so this succeeds either way. */
  resetPassword: (email: string) =>
    attempt(async () => {
      await sendPasswordResetEmail(requireAuth(), email.trim());
    }),

  /** Change the name shown on the board and in the profile menu. */
  updateName: (name: string) =>
    attempt(async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new AuthActionError("Enter your name.", "name");
      await updateProfile(requireUser(), { displayName: trimmed });
      refresh();
    }),

  /** Send the verification email again. "too-soon" when one went out in the last minute. */
  resendVerification: () => attempt(() => sendVerification(requireUser())),

  /** Ask Firebase for the latest account details (e.g. after confirming the email in another tab). */
  reloadUser: () =>
    attempt(async () => {
      await requireUser().reload();
      refresh();
    }),

  logOut: () =>
    attempt(async () => {
      await signOut(requireAuth());
    }),
};
