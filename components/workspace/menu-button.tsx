"use client";

import { Menu } from "lucide-react";
import { workspace } from "@/lib/workspace";

/** Opens the sidebar as a slide-out menu. Phones and tablets only: from lg up the sidebar is always shown. */
export function MenuButton() {
  return (
    <button
      type="button"
      onClick={() => workspace.setMenuOpen(true)}
      aria-label="Open menu"
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-surface hover:text-ink sm:px-3 lg:hidden"
    >
      <Menu className="size-4" />
      <span className="hidden sm:inline">Menu</span>
    </button>
  );
}
