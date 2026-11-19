import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/**
 * The workspace pages (/board, /settings, /help) share one sidebar, which stays
 * on screen as you move between them. The "(workspace)" folder doesn't change the URLs.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
