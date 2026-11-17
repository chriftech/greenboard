/**
 * POST /api/auth/send-verification
 *
 * Sends the signed-in user greenboard's own verification email (instead of
 * Firebase's plain one). The caller proves who they are with their Firebase ID
 * token, and the email only ever goes to that account's own address.
 *
 * Responses: 200 sent (or already verified) · 401 bad token · 429 asked too soon ·
 * 503 not configured · 502 couldn't send. On anything but 200/401/429 the app
 * falls back to Firebase's built-in email, so verification keeps working.
 */

import { getAdminAuth } from "@/lib/server/firebase-admin";
import { EmailSendError, isEmailConfigured, sendVerificationEmail } from "@/lib/server/verification-email";

/** One email per account per minute. In memory, so per server instance: enough to stop accidental repeats. */
const COOLDOWN_MS = 60_000;
const lastSent = new Map<string, number>();

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export async function POST(request: Request) {
  const auth = getAdminAuth();
  if (!auth || !isEmailConfigured()) return json(503, { error: "not-configured" });

  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json(401, { error: "missing-token" });

  let uid: string;
  try {
    ({ uid } = await auth.verifyIdToken(token));
  } catch {
    return json(401, { error: "invalid-token" });
  }

  // Read the account fresh: the token can predate the name being set at sign-up.
  const user = await auth.getUser(uid);
  if (!user.email) return json(400, { error: "no-email" });
  if (user.emailVerified) return json(200, { status: "already-verified" });

  const now = Date.now();
  if (now - (lastSent.get(uid) ?? 0) < COOLDOWN_MS) return json(429, { error: "too-soon" });
  lastSent.set(uid, now);

  // After confirming, Firebase's page offers a "Continue" link back to the board.
  const appUrl = process.env.APP_URL || new URL(request.url).origin;
  let link: string;
  try {
    link = await auth.generateEmailVerificationLink(user.email, { url: `${appUrl}/board` });
  } catch (error) {
    // The continue URL's domain must be in Firebase's authorized domains; without it, send a plain link.
    if ((error as { code?: string }).code !== "auth/unauthorized-continue-uri") {
      lastSent.delete(uid);
      console.error("[send-verification] couldn't create the link:", error);
      return json(502, { error: "link-failed" });
    }
    link = await auth.generateEmailVerificationLink(user.email);
  }

  try {
    await sendVerificationEmail({ name: user.displayName ?? "", email: user.email }, link);
  } catch (error) {
    lastSent.delete(uid);
    console.error("[send-verification]", error instanceof EmailSendError ? error.message : error);
    return json(502, { error: "send-failed" });
  }
  return json(200, { status: "sent" });
}
