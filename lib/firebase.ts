/**
 * Firebase, set up once in the browser. The settings come from the server (lib/config.ts),
 * which picks NEXT_PUBLIC_FIREBASE_* or FIREBASE_* depending on DEBUG and writes them into
 * the page as window.__GREENBOARD_FIREBASE__ before the app's code loads.
 *
 * Without them the app keeps working in guest mode and the auth pages say accounts
 * aren't set up yet.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  emulatorHost?: string;
};

/** The window property the server-rendered script fills in. */
export const FIREBASE_CONFIG_GLOBAL = "__GREENBOARD_FIREBASE__";

declare global {
  interface Window {
    [FIREBASE_CONFIG_GLOBAL]?: FirebaseWebConfig | null;
  }
}

function readConfig(): FirebaseWebConfig | null {
  if (typeof window === "undefined") return null;
  return window[FIREBASE_CONFIG_GLOBAL] ?? null;
}

/** True when the page was given Firebase settings. */
export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

let auth: Auth | null = null;

/** The Auth instance, or null when Firebase isn't configured or this isn't a browser. */
export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const config = readConfig();
  if (!config) return null;
  const { emulatorHost, ...appConfig } = config;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(appConfig);
  auth = getAuth(app);
  if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  return auth;
}
