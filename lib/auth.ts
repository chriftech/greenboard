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
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { setAuthHint } from "./auth-hint";

export type AuthUser = {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
};

export type AuthState =
  | { status: "loading"; user: null } // waiting for Firebase to say who's signed in
  | { status: "unavailable"; user: null } // Firebase isn't configured: guest mode only
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: AuthUser };

const LOADING: AuthState = { status: "loading", user: null };
const UNAVAILABLE: AuthState = { status: "unavailable", user: null };
const SIGNED_OUT: AuthState = { status: "signed-out", user: null };

let state: AuthState = isFirebaseConfigured ? LOADING : UNAVAILABLE;
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  // Remember whether this browser is signed in, for pages that redirect before Firebase has answered.
  if (next.status === "signed-in" || next.status === "signed-out") setAuthHint(next.status === "signed-in");
  listeners.forEach((l) => l());
}

function toAuthUser(u: User): AuthUser {
  return { uid: u.uid, name: u.displayName, email: u.email, photoURL: u.photoURL, emailVerified: u.emailVerified };
}

/** Re-read the current user (needed after profile changes, which onAuthStateChanged doesn't report). */
function refresh() {
  const user = getFirebaseAuth()?.currentUser;
  set(user ? { status: "signed-in", user: toAuthUser(user) } : SIGNED_OUT);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Start listening to Firebase the first time anything asks who's signed in.
  if (!started) {
    started = true;
    const auth = getFirebaseAuth();
    if (auth) onAuthStateChanged(auth, (u) => set(u ? { status: "signed-in", user: toAuthUser(u) } : SIGNED_OUT));
  }
  return () => listeners.delete(listener);
}

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

/** Firebase's error codes, in words a person can act on. */
function friendly(error: unknown): AuthActionError {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
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

/* ───────────────────────── Actions ───────────────────────── */

export const authActions = {
  logIn: (email: string, password: string) =>
    attempt(async () => {
      await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
    }),

  signUp: (name: string, email: string, password: string) =>
    attempt(async () => {
      const { user } = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      refresh(); // show the name straight away
      // Best effort: a failed verification email shouldn't undo a successful sign-up.
      sendEmailVerification(user).catch(() => {});
    }),

  logInWithGoogle: () =>
    attempt(async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(requireAuth(), provider);
    }),

  /** Firebase doesn't reveal whether the email has an account, so this succeeds either way. */
  resetPassword: (email: string) =>
    attempt(async () => {
      await sendPasswordResetEmail(requireAuth(), email.trim());
    }),

  logOut: () =>
    attempt(async () => {
      await signOut(requireAuth());
    }),
};
