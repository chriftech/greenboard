/**
 * A note in localStorage that this browser was signed in last time. Firebase keeps
 * the real session in IndexedDB and takes a moment to restore it, so pages that
 * behave differently when you're signed in (the landing page sends you to your
 * board) use this to avoid flashing the signed-out view first.
 *
 * It's only a hint: Firebase has the final say, and it's cleared on sign-out.
 * Kept free of Firebase imports so server components can use the script below.
 */

export const AUTH_HINT_KEY = "greenboard.auth.v1";

/** Set on <html> while a signed-in check is pending; globals.css hides the page meanwhile. */
export const AUTH_PENDING_ATTR = "data-auth-pending";

/** Pages that send signed-in users elsewhere (see SignedInRedirect). */
export const SIGNED_OUT_ONLY_PATHS = ["/"];

/**
 * Runs in <head> before the first paint (app/layout.tsx): on a signed-out-only page,
 * hide it if this browser was signed in last time. In-app navigation is handled by
 * SignedInRedirect. Must stay self-contained: it's inlined as a string.
 */
export const AUTH_PENDING_SCRIPT = `(function(){try{if(${JSON.stringify(SIGNED_OUT_ONLY_PATHS)}.indexOf(location.pathname)>-1&&localStorage.getItem("${AUTH_HINT_KEY}"))document.documentElement.setAttribute("${AUTH_PENDING_ATTR}","")}catch(e){}})()`;

export function hasAuthHint() {
  try {
    return window.localStorage.getItem(AUTH_HINT_KEY) !== null;
  } catch {
    return false;
  }
}

export function setAuthHint(signedIn: boolean) {
  try {
    if (signedIn) window.localStorage.setItem(AUTH_HINT_KEY, "1");
    else window.localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // Storage blocked: pages just wait for Firebase without the head start.
  }
}
