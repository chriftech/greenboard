"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MobileSidebar, Sidebar, type SidebarProps } from "@/components/board/sidebar";
import { isScheduledToday, isUpcoming } from "@/components/board/schedule";
import { getServerTasks, getTasks, subscribeTasks, type Task } from "@/lib/tasks";
import { findTag, useTags } from "@/lib/tags";
import { tourActions } from "@/lib/tour";
import { requestBoard, useWorkspace, workspace, type NavTarget, type View } from "@/lib/workspace";

const PAGES = { "/board": "board", "/settings": "settings", "/help": "help" } as const;

// This layout is prerendered once for all three pages, so the server can't know which
// one is showing; the highlight is worked out in the browser, right after loading.
const noSubscribe = () => () => {};
const inBrowser = () => true;
const onServer = () => false;

function inView(t: Task, v: View) {
  if (v === "board") return true;
  if (!t.start || !t.end) return false;
  const timeline = { start: t.start, end: t.end };
  return v === "today" ? isScheduledToday(timeline) : isUpcoming(timeline);
}

/**
 * The frame around the workspace pages (/board, /settings, /help): the sidebar on
 * the left (a slide-out menu on phones) and the page beside it. The sidebar stays
 * mounted as you move between these pages, so its size, scroll, search and selection carry over.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(noSubscribe, inBrowser, onServer);
  const page = hydrated ? (PAGES[pathname as keyof typeof PAGES] ?? null) : null;
  const onBoard = page === "board";

  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks);
  const tags = useTags();
  const { view, filter, tag, query, menuOpen } = useWorkspace();

  const all = (tasks ?? []).filter((t) => t.deletedAt === undefined);
  const pending = all.filter((t) => !t.done);
  const trashed = (tasks ?? []).length - all.length;
  const activeTag = tag && tags.some((t) => t.id === tag) ? tag : null;

  /** Open the board (from Settings or Help) so it can show what was picked. */
  const toBoard = () => {
    if (!onBoard) router.push("/board");
  };

  const sidebar: SidebarProps = {
    page,
    // Settings and Help aren't board views, so nothing in the workspace list is highlighted there.
    active: !onBoard ? null : view !== "board" ? view : filter === "done" ? "completed" : "board",
    onNavigate: (target: NavTarget) => {
      if (!requestBoard({ type: "navigate", target })) toBoard();
    },
    tag: activeTag,
    onTag: (t) => {
      workspace.setTag(t);
      toBoard();
    },
    query,
    onQuery: (q) => {
      workspace.setQuery(q);
      // Typing a search on another page takes you to the board's results (the search box keeps focus).
      if (q.trim()) toBoard();
    },
    tags,
    onEditTag: (t) => {
      if (!requestBoard({ type: "editTag", tag: t })) toBoard();
    },
    onDeleteTag: (t) => {
      if (!requestBoard({ type: "deleteTag", tag: t })) toBoard();
    },
    onStartTour: () => {
      // The tour walks through the board, so start it there.
      if (!onBoard) return router.push("/board?tour");
      // From the phone menu: let the drawer close first, so the tour can see the board.
      if (menuOpen) {
        workspace.setMenuOpen(false);
        window.setTimeout(tourActions.start, 350);
      } else tourActions.start();
    },
    counts: {
      board: pending.length,
      today: pending.filter((t) => inView(t, "today")).length,
      upcoming: pending.filter((t) => inView(t, "upcoming")).length,
      completed: all.length - pending.length,
      trash: trashed,
      tags: Object.fromEntries(tags.map((t) => [t.id, pending.filter((x) => findTag(tags, x.tag).id === t.id).length])),
    },
  };

  return (
    <div className="flex min-h-full flex-1 bg-paper text-ink">
      <Sidebar {...sidebar} />
      <MobileSidebar {...sidebar} open={menuOpen} onOpenChange={workspace.setMenuOpen} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
