/**
 * Firebase, set up once in the browser. The config comes from NEXT_PUBLIC_FIREBASE_*
 * variables (see .env.example). They're a web app's public identifiers, not secrets:
 * access is controlled by Firebase Auth and its authorized domains.
 *
 * Without them the app keeps working in guest mode and the auth pages say accounts
 * aren't set up yet.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

// Each variable is written out in full: Next.js only inlines literal process.env.NEXT_PUBLIC_* reads.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

/** Optional, for local testing: e.g. "127.0.0.1:9099" for the Firebase Auth emulator. */
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

/** True when the required Firebase settings are present. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let auth: Auth | null = null;

/** The Auth instance, or null when Firebase isn't configured or this isn't a browser. */
export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  if (!isFirebaseConfigured || typeof window === "undefined") return null;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  return auth;
}
