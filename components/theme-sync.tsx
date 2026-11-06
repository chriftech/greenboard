"use client";

import { useEffect, useLayoutEffect } from "react";
import { applyTheme, resolveTheme, watchSystemTheme } from "@/lib/theme";

/**
 * Mounted once in the root layout. The inline script in <head> sets the theme
 * before paint; this re-applies it before paint after React's development-mode
 * remount resets <html>'s classes (a no-op in production), and keeps following
 * the device setting until the user picks a theme.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(resolveTheme());
  }, []);

  useEffect(() => watchSystemTheme(), []);

  return null;
}
