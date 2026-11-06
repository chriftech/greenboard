"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { isDark, isDarkOnServer, setTheme, subscribeTheme } from "@/lib/theme";

/** Sun/moon button that switches between light and dark mode. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeTheme, isDark, isDarkOnServer);
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`group grid size-9 place-items-center rounded-xl text-ink/70 transition-colors hover:bg-surface hover:text-ink ${className}`}
    >
      <span className="relative grid size-4 place-items-center">
        {/* Both icons stay mounted so the swap can rotate/fade smoothly. */}
        <Sun
          className={`absolute size-4 transition-all duration-300 ${
            dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        <Moon
          className={`absolute size-4 transition-all duration-300 ${
            dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}
