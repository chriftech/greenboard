"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  LifeBuoy,
  ListChecks,
  ListFilter,
  PanelLeft,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  SunMoon,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { tourActions, useTourRunning } from "@/lib/tour";

/* ───────────────────────── Steps ───────────────────────── */

type Step = {
  /**
   * `data-tour` ids to spotlight, in order of preference: the first one that's
   * on screen wins (e.g. the sidebar on desktops, the Menu button on phones).
   * No targets, or none visible, shows the card centred.
   */
  targets?: string[];
  icon: LucideIcon;
  title: string;
  /** Text per target id, falling back to `body`. */
  bodyFor?: Record<string, string>;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to greenboard 👋",
    body: "A quick look around: it takes under a minute. Use the arrow keys or the buttons below, and press Esc to skip.",
  },
  {
    targets: ["tags"],
    icon: Tag,
    title: "Pick a tag first",
    body: "Every new task gets the tag selected here. Default is preselected, and you can make up to 5 tags of your own.",
  },
  {
    targets: ["new-task"],
    icon: PenLine,
    title: "Write a task",
    body: "Type what needs doing and press Enter. It lands at the top of your board.",
  },
  {
    targets: ["task-extras"],
    icon: SlidersHorizontal,
    title: "Add the details up front",
    body: "Optionally give it a start and end time, a priority, and someone to do it, before you add it.",
  },
  {
    targets: ["filters"],
    icon: ListFilter,
    title: "Switch between views",
    body: "See everything, just what's left, or what's done. The numbers keep count.",
  },
  {
    targets: ["tasks"],
    icon: ListChecks,
    title: "Work through your tasks",
    body: "Tick the circle to complete a task. Click a task to edit its details and description, and drag to reorder.",
  },
  {
    targets: ["sidebar", "menu"],
    icon: PanelLeft,
    title: "Find things fast",
    bodyFor: {
      sidebar: "Search (⌘/Ctrl K), Today and Upcoming, your tags and Trash all live in the sidebar. Drag its edge to resize it.",
      menu: "Search, Today and Upcoming, your tags and Trash are all in the menu.",
    },
    body: "Search, Today and Upcoming, your tags and Trash all live in the sidebar.",
  },
  {
    targets: ["theme"],
    icon: SunMoon,
    title: "Light or dark",
    body: "Switch themes whenever you like. greenboard remembers your choice.",
  },
  {
    targets: ["help"],
    icon: LifeBuoy,
    title: "You're all set",
    bodyFor: {
      help: "Questions, shortcuts and feedback are in Help & feedback. Replay this tour any time from Take the tour.",
    },
    body: "Replay this tour any time from the menu or the Help page. Happy planning!",
  },
];

/* ───────────────────────── Layout ───────────────────────── */

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8; // space between the target and the spotlight's edge
const GAP = 14; // space between the spotlight and the card
const EDGE = 16; // keep the card this far from the viewport's edges

function findTarget(step: Step): { id: string; el: HTMLElement } | null {
  for (const id of step.targets ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { id, el };
  }
  return null;
}

function spotlightRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && a.width === b.width && a.height === b.height);

/** Which side of the card the arrow sits on (pointing at the spotlight), if any. */
type Side = "top" | "bottom" | "left" | "right";
type Placement = { style: CSSProperties; caret: { side: Side; offset: number } | null };

const CARET_MIN = 22; // keep the arrow clear of the card's rounded corners

/** Place the card below, above, right or left of the spotlight, whichever fits first. */
function cardPosition(spot: Rect | null, card: { width: number; height: number }): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - card.width - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - card.height - EDGE);
  // Point the arrow at the middle of the spotlight, as far as the card's edge allows.
  const along = (start: number, size: number, center: number) =>
    Math.min(Math.max(center - start, CARET_MIN), size - CARET_MIN);

  if (!spot) return { style: { left: clampX((vw - card.width) / 2), top: clampY((vh - card.height) / 2) }, caret: null };

  const cx = spot.left + spot.width / 2;
  const cy = spot.top + spot.height / 2;
  const below = spot.top + spot.height + GAP;
  const above = spot.top - GAP - card.height;
  const right = spot.left + spot.width + GAP;
  const left = spot.left - GAP - card.width;

  if (below + card.height <= vh - EDGE) {
    const x = clampX(spot.left);
    return { style: { left: x, top: below }, caret: { side: "top", offset: along(x, card.width, cx) } };
  }
  if (above >= EDGE) {
    const x = clampX(spot.left);
    return { style: { left: x, top: above }, caret: { side: "bottom", offset: along(x, card.width, cx) } };
  }
  if (right + card.width <= vw - EDGE) {
    const y = clampY(spot.top);
    return { style: { left: right, top: y }, caret: { side: "left", offset: along(y, card.height, cy) } };
  }
  if (left >= EDGE) {
    const y = clampY(spot.top);
    return { style: { left, top: y }, caret: { side: "right", offset: along(y, card.height, cy) } };
  }
  // Nothing fits (a tall target on a small screen): pin to the bottom, no arrow.
  return { style: { left: clampX((vw - card.width) / 2), top: vh - card.height - EDGE }, caret: null };
}

/* ───────────────────────── Tour ───────────────────────── */

export function Tour() {
  const running = useTourRunning();
  // Remount per run, so every run starts at step 1.
  return running ? <TourRun /> : null;
}

function TourRun() {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState({ width: 340, height: 220 });
  // Re-place the card when the window changes size (rotation, resizing).
  const [, setViewport] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<Element | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const body = (targetId && step.bodyFor?.[targetId]) || step.body;

  const next = () => (last ? tourActions.end() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Remember what had focus, and give it back when the tour closes.
  useEffect(() => {
    restoreFocus.current = document.activeElement;
    return () => {
      const el = restoreFocus.current;
      // Started by itself (nothing focused yet): hand focus to the new-task box, ready to type.
      const target =
        el instanceof HTMLElement && el.isConnected && el !== document.body ? el : document.getElementById("new-task");
      target?.focus({ preventScroll: true });
    };
  }, []);

  // On each step: bring the target into view, then follow it while it moves
  // (smooth scrolling, layout shifts, resizes) for as long as the step is shown.
  useEffect(() => {
    const found = findTarget(step);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    found?.el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });

    let frame = 0;
    // undefined (not null) so the first frame always updates, even for a step with nothing to light.
    let prev: Rect | null | undefined = undefined;
    const tick = () => {
      const now = findTarget(step);
      const rect = now ? spotlightRect(now.el) : null;
      if (prev === undefined || !sameRect(prev, rect)) {
        prev = rect;
        setSpot(rect);
        setTargetId(now?.id ?? null);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // Measure the card so it can be placed; move focus to it for screen readers.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => setCardSize({ width: card.offsetWidth, height: card.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    card.focus({ preventScroll: true });
    return () => ro.disconnect();
  }, [index]);

  useEffect(() => {
    const onResize = () => setViewport(`${window.innerWidth}x${window.innerHeight}`);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keyboard: arrows step through, Esc skips, Tab stays inside the card.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        tourActions.end();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (last) tourActions.end();
        else setIndex((i) => i + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Tab" && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (!items.length) return;
        const first = items[0];
        const final = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === cardRef.current)) {
          e.preventDefault();
          final.focus();
        } else if (!e.shiftKey && (active === final || !cardRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [last]);

  const { style: position, caret } =
    typeof window === "undefined" ? { style: {}, caret: null } : cardPosition(spot, cardSize);
  const Icon = step.icon;
  const progress = ((index + 1) / STEPS.length) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      {/* Blocks the page while touring; the spotlight's shadow does the dimming. */}
      <div aria-hidden className="absolute inset-0" />

      <div
        aria-hidden
        // With no target it shrinks to a point in the middle: still dimming the page, with nothing lit.
        data-empty={spot ? undefined : ""}
        className="gb-tour-spot pointer-events-none fixed rounded-2xl"
        style={
          spot
            ? { top: spot.top, left: spot.left, width: spot.width, height: spot.height }
            : { top: "50%", left: "50%", width: 0, height: 0 }
        }
      />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="gb-tour-card fixed w-[min(23rem,calc(100vw-2rem))] rounded-[22px] p-5 text-ink outline-none"
        style={position}
      >
        {caret && (
          <span
            aria-hidden
            data-side={caret.side}
            className="gb-tour-caret"
            style={caret.side === "top" || caret.side === "bottom" ? { left: caret.offset } : { top: caret.offset }}
          />
        )}

        <div className="flex items-center gap-3">
          {/* Keyed so the icon pops in on each step. */}
          <span key={index} className="gb-tour-icon grid size-11 shrink-0 place-items-center rounded-2xl bg-peach text-on-accent">
            <Icon className="size-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink/55">
              Step {index + 1} of {STEPS.length}
            </p>
            <div
              role="progressbar"
              aria-label="Tour progress"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={index + 1}
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/12"
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-iris to-peach transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => tourActions.end()}
            aria-label="Skip the tour"
            title="Skip the tour (Esc)"
            className="-mr-1 grid size-8 shrink-0 place-items-center self-start rounded-lg text-ink/55 transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Keyed so the text fades in on each step. */}
        <div key={index} className="gb-tour-text">
          <h2 id={titleId} className="mt-4 font-display text-xl font-bold leading-snug">
            {step.title}
          </h2>
          <p id={bodyId} className="mt-1.5 text-[15px] leading-relaxed text-ink/80">
            {body}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 sm:justify-between">
          {/* Keyboard hint: not shown on phones and touch screens, where there are no arrow keys. */}
          <span className="hidden text-xs font-medium text-ink/50 sm:inline [@media(hover:none)]:hidden">
            <kbd className="font-sans">←</kbd> <kbd className="font-sans">→</kbd> to move · Esc to skip
          </span>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-ink/75 transition-colors hover:bg-ink/10 hover:text-ink"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-xl bg-peach px-4 py-2 text-sm font-bold text-on-accent shadow-[0_8px_20px_-8px_rgb(255_201_169/0.8)] transition-transform hover:-translate-y-0.5"
            >
              {last ? "Done" : index === 0 ? "Show me" : "Next"}
              {!last && <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
