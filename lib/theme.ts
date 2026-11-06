/**
 * Light/dark theme. The "dark" class on <html> switches every colour token
 * (see app/globals.css). The user's choice is saved in localStorage; with no
 * saved choice the device's colour-scheme setting is used.
 */

export type Theme = "light" | "dark";

export const THEME_KEY = "greenboard.theme";

/**
 * Runs in <head> before the first paint (app/layout.tsx), so the page never
 * flashes the wrong theme. Must stay self-contained: it's inlined as a string.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function storedTheme(): Theme | null {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "light" ? t : null;
  } catch {
    return null;
  }
}

const systemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/** The theme that should be showing: the saved choice, else the device setting. */
export const resolveTheme = (): Theme => storedTheme() ?? systemTheme();

const listeners = new Set<() => void>();

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  listeners.forEach((l) => l());
}

/** Switch theme and remember the choice. */
export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the theme still switches for this visit.
  }
  applyTheme(theme);
}

/** For useSyncExternalStore: whether dark mode is currently showing. */
export const isDark = () => document.documentElement.classList.contains("dark");
export const isDarkOnServer = () => false;

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Follow the device setting live, but only while the user hasn't picked a theme. */
export function watchSystemTheme() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (!storedTheme()) applyTheme(systemTheme());
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
