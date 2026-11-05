"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
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
} from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { TAGS } from "@/lib/tasks";

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

/* ───────────────────────── Sidebar ───────────────────────── */

const WORKSPACE = [
  { label: "My board", icon: LayoutDashboard, active: true },
  { label: "Today", icon: Sun },
  { label: "Upcoming", icon: CalendarRange },
  { label: "Completed", icon: CircleCheckBig },
  { label: "Trash", icon: Trash2 },
];

/**
 * Left sidebar for the board. Drag (or use the arrow keys on) its right edge
 * to resize it; the size and collapsed state are remembered in this browser.
 * Hidden below the md breakpoint.
 */
export function Sidebar() {
  const { width, collapsed } = useSyncExternalStore(subscribe, read, () => DEFAULT_STATE);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const shown = collapsed ? RAIL_WIDTH : width;

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

  const toggle = () => write({ width, collapsed: !collapsed });

  return (
    <aside
      aria-label="Sidebar"
      style={{ width: shown }}
      className={`sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-forest/10 bg-white/75 backdrop-blur-xl md:flex ${
        resizing ? "" : "transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      }`}
    >
      {/* Brand + collapse */}
      <div className={`flex items-center gap-2 px-4 pb-3 pt-5 ${collapsed ? "flex-col" : "justify-between"}`}>
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Greenboard home">
          <Logo className="size-9 shrink-0" />
          {!collapsed && <span className="truncate font-display text-xl font-bold tracking-tight">greenboard</span>}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-forest/50 transition-colors hover:bg-mint hover:text-forest"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {/* Search (static for now) */}
      <div className="px-3 pb-2">
        {collapsed ? (
          <SidebarItem icon={<Search className="size-4" />} label="Search" collapsed />
        ) : (
          <label className="flex items-center gap-2 rounded-xl border border-forest/10 bg-cream px-3 py-2 text-sm text-forest/45 focus-within:border-leaf">
            <Search className="size-4 shrink-0" />
            <input
              type="search"
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="min-w-0 flex-1 bg-transparent text-forest placeholder:text-forest/40 focus:outline-none"
            />
            <kbd className="hidden rounded-md border border-forest/10 bg-white px-1.5 text-[10px] font-semibold text-forest/40 lg:block">
              ⌘K
            </kbd>
          </label>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
        <SectionLabel collapsed={collapsed}>Workspace</SectionLabel>
        <ul className="space-y-0.5">
          {WORKSPACE.map(({ label, icon: Icon, active }) => (
            <li key={label}>
              <SidebarItem icon={<Icon className="size-4" />} label={label} active={active} collapsed={collapsed} />
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
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-0.5 border-t border-forest/10 px-3 py-3">
        <SidebarItem icon={<Settings className="size-4" />} label="Settings" collapsed={collapsed} />
        <SidebarItem icon={<LifeBuoy className="size-4" />} label="Help & feedback" collapsed={collapsed} />
        <div className={`mt-2 flex items-center gap-3 rounded-xl px-2 py-2 ${collapsed ? "justify-center" : ""}`}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zest text-xs font-bold text-forest">
            G
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Guest</span>
              <span className="block truncate text-xs text-forest/50">Personal workspace</span>
            </span>
          )}
        </div>
      </div>

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
              resizing ? "bg-leaf" : "bg-transparent group-hover:bg-leaf/60 group-focus-visible:bg-leaf"
            }`}
          />
        </div>
      )}
    </aside>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return collapsed ? (
    <div aria-hidden className="mx-3 my-3 h-px bg-forest/10" />
  ) : (
    <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-widest text-forest/40">{children}</p>
  );
}

/** A static sidebar option. Only "My board" is active; the rest are placeholders for now. */
function SidebarItem({
  icon,
  label,
  active = false,
  collapsed,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        collapsed ? "justify-center px-0" : ""
      } ${active ? "bg-forest text-zest" : "text-forest/70 hover:bg-mint hover:text-forest"}`}
    >
      <span className="grid size-4 shrink-0 place-items-center">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
