"use client";

import { useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AUTH_PENDING_ATTR, hasAuthHint } from "@/lib/auth-hint";

/** How long to keep the page hidden if Firebase hasn't said who's signed in (e.g. it's offline). */
const GIVE_UP_MS = 3000;

/**
 * Sends signed-in users from the landing page to their board. While it's still
 * checking, and this browser was signed in last time, the page stays hidden so
 * it doesn't flash before the redirect. Guests see the page straight away.
 */
export function SignedInRedirect() {
  const auth = useAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const signedIn = auth.status === "signed-in";
    if (signedIn || (auth.status === "loading" && hasAuthHint())) root.setAttribute(AUTH_PENDING_ATTR, "");
    else root.removeAttribute(AUTH_PENDING_ATTR);
    if (signedIn) router.replace("/board");
  }, [auth.status, router]);

  // Never leave the page hidden for long, or after leaving it.
  useEffect(() => {
    const root = document.documentElement;
    const timer = window.setTimeout(() => {
      if (root.hasAttribute(AUTH_PENDING_ATTR) && auth.status === "loading") root.removeAttribute(AUTH_PENDING_ATTR);
    }, GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [auth.status]);
  useEffect(() => () => document.documentElement.removeAttribute(AUTH_PENDING_ATTR), []);

  return null;
}
