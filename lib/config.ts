/**
 * Where greenboard's Firebase web settings come from, decided by the DEBUG variable:
 *
 *   DEBUG=true   → the NEXT_PUBLIC_FIREBASE_* variables (handy locally, in .env)
 *   otherwise    → the same names without the prefix: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, …
 *
 * Either way the values are read here, on the server, and handed to the browser when
 * the page is rendered (see firebaseConfigScript and app/layout.tsx). The browser code
 * never reads process.env itself, so nothing is baked into the JavaScript bundle.
 *
 * Note: the browser still receives these values, because Firebase sign-in runs there.
 * They're the web app's public identifiers, not secrets. Real secrets (service account,
 * SMTP) are read only by server code and never sent to the browser.
 */

import "server-only";
import { FIREBASE_CONFIG_GLOBAL, type FirebaseWebConfig } from "./firebase";

/** True only when DEBUG is exactly "true" (any case). Unset or anything else means off. */
export const DEBUG = process.env.DEBUG?.trim().toLowerCase() === "true";

/** Reads FIREBASE_<name>, or NEXT_PUBLIC_FIREBASE_<name> in debug mode. Empty counts as unset. */
function firebaseVar(name: string): string | undefined {
  const key = DEBUG ? `NEXT_PUBLIC_FIREBASE_${name}` : `FIREBASE_${name}`;
  return process.env[key]?.trim() || undefined;
}

/** The Firebase web settings, or null when the required ones are missing (guest mode only). */
export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const config: FirebaseWebConfig = {
    apiKey: firebaseVar("API_KEY") ?? "",
    authDomain: firebaseVar("AUTH_DOMAIN") ?? "",
    projectId: firebaseVar("PROJECT_ID") ?? "",
    appId: firebaseVar("APP_ID") ?? "",
    storageBucket: firebaseVar("STORAGE_BUCKET"),
    messagingSenderId: firebaseVar("MESSAGING_SENDER_ID"),
    // Local testing only: e.g. "127.0.0.1:9099" for the Firebase Auth emulator.
    emulatorHost: DEBUG ? firebaseVar("AUTH_EMULATOR_HOST") : undefined,
  };
  return config.apiKey && config.authDomain && config.projectId && config.appId ? config : null;
}

/** An inline script that gives the browser the settings before any app code runs. */
export function firebaseConfigScript(): string {
  // Escape "<" so a value can never close the <script> tag early.
  const json = JSON.stringify(getFirebaseWebConfig()).replace(/</g, "\\u003c");
  return `window.${FIREBASE_CONFIG_GLOBAL}=${json};`;
}
