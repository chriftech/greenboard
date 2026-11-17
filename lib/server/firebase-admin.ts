/**
 * Firebase Admin, for server code only (route handlers). It uses a service
 * account: a real secret, read from server-only variables (no NEXT_PUBLIC_
 * prefix, so it never reaches the browser). Never import this from a client
 * component.
 */

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

const ADMIN_APP = "greenboard-admin";

/** The Admin Auth instance, or null when the service account isn't configured. */
export function getAdminAuth(): Auth | null {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // .env files keep the key on one line with literal "\n"s; turn them back into line breaks.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;

  const app: App = getApps().some((a) => a.name === ADMIN_APP)
    ? getApp(ADMIN_APP)
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, ADMIN_APP);
  return getAuth(app);
}
