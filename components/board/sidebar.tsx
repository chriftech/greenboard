"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  CalendarRange,
  CircleCheckBig,
  LayoutDashboard,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Logo } from "@/components/landing/logo";
import { TAGS, type TagId } from "@/lib/tasks";

/* ───────────────────────── Types ───────────────────────── */

/** Sidebar destinations. "completed" and "trash" are shortcuts handled by the board. */
export type NavTarget = "board" | "today" | "upcoming" | "completed" | "trash";

export type SidebarProps = {
  /** Which workspace option is highlighted. */
  active: Exclude<NavTarget, "trash">;
  onNavigate: (target: NavTarget) => void;
  tag: TagId | null;
  onTag: (tag: TagId | null) => void;
  query: string;
  onQuery: (query: string) => void;
  counts: Record<NavTarget, number> & { tags: Record<TagId, number> };
};

/* ───────────────────────── Persisted size ───────────────────────── */

const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 272;
const RAIL_WIDTH = 72;
const KEY = "greenboard.sidebar.v1";

type SidebarState = { width: number; collapsed: boolean };
const DEFAULT_STATE: SidebarState = { width: DEFAULT_WIDTH, collapsed: false };

const clamp = (w: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));

let state: SidebarState | null = null;
const listeners = new Set<() => void>();

function read(): SidebarState {
  if (state) return state;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    state = {
      width: typeof raw?.width === "number" ? clamp(raw.width) : DEFAULT_WIDTH,
      collapsed: raw?.collapsed === true,
    };
  } catch {
    state = DEFAULT_STATE;
  }
  return state;
}

function write(next: SidebarState, persist = true) {
  state = next;
  if (persist) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Blocked storage: the size just won't be remembered.
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/* ───────────────────────── Desktop sidebar ───────────────────────── */

/**
 * Resizable left sidebar, shown from the md breakpoint up. Drag (or use the
 * arrow keys on) its right edge to resize; size and collapsed state are
 * remembered in this browser. ⌘K / Ctrl+K focuses its search.
 */
export function Sidebar(props: SidebarProps) {
  const { width, collapsed } = useSyncExternalStore(subscribe, read, () => DEFAULT_STATE);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const shown = collapsed ? RAIL_WIDTH : width;

  // ⌘K / Ctrl+K: expand if needed and focus search (desktop only; the sidebar is hidden on phones).
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      if (!window.matchMedia("(min-width: 48rem)").matches) return;
      e.preventDefault();
      if (read().collapsed) write({ ...read(), collapsed: false });
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (collapsed || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    // Live update while dragging; saved to storage on release.
    write({ width: clamp(drag.current.startWidth + e.clientX - drag.current.startX), collapsed: false }, false);
  }

  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    setResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    write(read());
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 48 : 16;
    const current = read().width; // latest value, even if keys repeat faster than React re-renders
    const next =
      e.key === "ArrowLeft" ? current - step
      : e.key === "ArrowRight" ? current + step
      : e.key === "Home" ? MIN_WIDTH
      : e.key === "End" ? MAX_WIDTH
      : null;
    if (next === null) return;
    e.preventDefault();
    write({ width: clamp(next), collapsed: false });
  }

  return (
    <aside
      aria-label="Sidebar"
      style={{ width: shown }}
      className={`sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-ink/10 bg-white/75 backdrop-blur-xl md:flex ${
        resizing ? "" : "transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      }`}
    >
      <SidebarBody
        {...props}
        collapsed={collapsed}
        searchRef={searchRef}
        topRight={
          <button
            type="button"
            onClick={() => write({ width, collapsed: !collapsed })}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/50 transition-colors hover:bg-mist hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        }
        onExpandForSearch={() => {
          write({ width, collapsed: false });
          requestAnimationFrame(() => searchRef.current?.focus());
        }}
      />

      {/* Resize handle on the right edge */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          onDoubleClick={() => write({ width: DEFAULT_WIDTH, collapsed: false })}
          title="Drag to resize · double-click to reset"
          className="group absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none outline-none"
        >
          <span
            className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${
              resizing ? "bg-iris" : "bg-transparent group-hover:bg-iris/60 group-focus-visible:bg-iris"
            }`}
          />
        </div>
      )}
    </aside>
  );
}

/* ───────────────────────── Mobile sidebar ───────────────────────── */

/** The same sidebar as a slide-out panel for phones, opened from the header's menu button. */
export function MobileSidebar({
  open,
  onOpenChange,
  ...props
}: SidebarProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  // Close after choosing a destination or tag; typing in search keeps it open.
  const close = () => onOpenChange(false);
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="left">
      <DrawerContent
        className="bg-paper text-ink md:hidden"
        style={{ "--drawer-content-width": "min(20rem, 86vw)" } as CSSProperties}
      >
        <DrawerTitle className="sr-only">Menu</DrawerTitle>
        <DrawerDescription className="sr-only">Board views, tags and search.</DrawerDescription>
        <div className="flex h-full min-h-0 flex-col">
          <SidebarBody
            {...props}
            collapsed={false}
            onNavigate={(t) => {
              props.onNavigate(t);
              close();
            }}
            onTag={(t) => {
              props.onTag(t);
              close();
            }}
            topRight={
              <DrawerClose
                aria-label="Close menu"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/50 transition-colors hover:bg-mist hover:text-ink"
              >
                <X className="size-4" />
              </DrawerClose>
            }
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ───────────────────────── Shared content ───────────────────────── */

const WORKSPACE: { target: NavTarget; label: string; icon: typeof Sun }[] = [
  { target: "board", label: "My board", icon: LayoutDashboard },
  { target: "today", label: "Today", icon: Sun },
  { target: "upcoming", label: "Upcoming", icon: CalendarRange },
  { target: "completed", label: "Completed", icon: CircleCheckBig },
  { target: "trash", label: "Trash", icon: Trash2 },
];

function SidebarBody({
  active,
  onNavigate,
  tag,
  onTag,
  query,
  onQuery,
  counts,
  collapsed,
  topRight,
  searchRef,
  onExpandForSearch,
}: SidebarProps & {
  collapsed: boolean;
  topRight: ReactNode;
  searchRef?: RefObject<HTMLInputElement | null>;
  onExpandForSearch?: () => void;
}) {
  return (
    <>
      {/* Brand + collapse/close */}
      <div className={`flex items-center gap-2 px-4 pb-3 pt-5 ${collapsed ? "flex-col" : "justify-between"}`}>
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Greenboard home">
          <Logo className="size-9 shrink-0" />
          {!collapsed && <span className="truncate font-display text-xl font-bold tracking-tight">greenboard</span>}
        </Link>
        {topRight}
      </div>

      {/* Search: filters the board by title and description */}
      <div className="px-3 pb-2">
        {collapsed ? (
          <SidebarItem icon={<Search className="size-4" />} label="Search" collapsed onClick={onExpandForSearch} />
        ) : (
          <label className="flex items-center gap-2 rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink/45 focus-within:border-iris focus-within:bg-white">
            <Search className="size-4 shrink-0" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onQuery("")}
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQuery("")}
                aria-label="Clear search"
                className="grid size-5 place-items-center rounded-md text-ink/50 hover:bg-mist hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="hidden rounded-md border border-ink/10 bg-white px-1.5 text-[10px] font-semibold text-ink/40 lg:block">
                ⌘K
              </kbd>
            )}
          </label>
        )}
      </div>

      <nav aria-label="Board" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
        <SectionLabel collapsed={collapsed}>Workspace</SectionLabel>
        <ul className="space-y-0.5">
          {WORKSPACE.map(({ target, label, icon: Icon }) => (
            <li key={target}>
              <SidebarItem
                icon={<Icon className="size-4" />}
                label={label}
                count={counts[target]}
                countTone={target === "trash" ? "coral" : "muted"}
                active={target === active}
                collapsed={collapsed}
                onClick={() => onNavigate(target)}
              />
            </li>
          ))}
        </ul>

        <SectionLabel collapsed={collapsed}>Tags</SectionLabel>
        <ul className="space-y-0.5">
          {TAGS.map((t) => (
            <li key={t.id}>
              <SidebarItem
                icon={<span className={`size-2.5 rounded-full ${t.dot}`} />}
                label={t.label}
                count={counts.tags[t.id]}
                active={tag === t.id}
                pressed={tag === t.id}
                collapsed={collapsed}
                onClick={() => onTag(tag === t.id ? null : t.id)}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Not wired to anything yet */}
      <div className="space-y-0.5 border-t border-ink/10 px-3 py-3">
        <SidebarItem icon={<Settings className="size-4" />} label="Settings" collapsed={collapsed} />
        <SidebarItem icon={<LifeBuoy className="size-4" />} label="Help & feedback" collapsed={collapsed} />
        <div className={`mt-2 flex items-center gap-3 rounded-xl px-2 py-2 ${collapsed ? "justify-center" : ""}`}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-peach text-xs font-bold text-ink">
            G
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Guest</span>
              <span className="block truncate text-xs text-ink/50">Personal workspace</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return collapsed ? (
    <div aria-hidden className="mx-3 my-3 h-px bg-ink/10" />
  ) : (
    <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-widest text-ink/40">{children}</p>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  countTone = "muted",
  active = false,
  pressed,
  collapsed,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  countTone?: "muted" | "coral";
  active?: boolean;
  /** For toggles (tags): exposes on/off state instead of "current page". */
  pressed?: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const showCount = typeof count === "number" && count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active && pressed === undefined ? "page" : undefined}
      aria-pressed={pressed}
      aria-label={collapsed ? (showCount ? `${label}, ${count}` : label) : undefined}
      title={collapsed ? label : undefined}
      className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        collapsed ? "justify-center px-0" : ""
      } ${active ? "bg-ink text-peach" : "text-ink/70 hover:bg-mist hover:text-ink"}`}
    >
      <span className="grid size-4 shrink-0 place-items-center">{icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {showCount &&
        (collapsed ? (
          <span
            aria-hidden
            className={`absolute right-2 top-1.5 size-1.5 rounded-full ${countTone === "coral" ? "bg-coral" : "bg-iris"}`}
          />
        ) : (
          <span
            className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
              countTone === "coral"
                ? "bg-coral text-white"
                : active
                  ? "bg-white/15 text-peach"
                  : "bg-ink/5 text-ink/55"
            }`}
          >
            {count}
          </span>
        ))}
    </button>
  );
}
