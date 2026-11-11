"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { tourActions, useTourRunning } from "@/lib/tour";

/* ───────────────────────── Steps ───────────────────────── */

type Step = {
  /**
   * `data-tour` ids to spotlight, in order of preference: the first one that's
   * on screen wins (e.g. the sidebar on desktops, the Menu button on phones).
   * No targets, or none visible, shows the card centred.
   */
  targets?: string[];
  title: string;
  /** Text per target id, falling back to `body`. */
  bodyFor?: Record<string, string>;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to greenboard 👋",
    body: "A quick look around: it takes under a minute. Use the arrow keys or the buttons below, and press Esc to skip.",
  },
  {
    targets: ["tags"],
    title: "Pick a tag first",
    body: "Every new task gets the tag selected here. Default is preselected, and you can make up to 5 tags of your own.",
  },
  {
    targets: ["new-task"],
    title: "Write a task",
    body: "Type what needs doing and press Enter. It lands at the top of your board.",
  },
  {
    targets: ["task-extras"],
    title: "Add the details up front",
    body: "Optionally give it a start and end time, a priority, and someone to do it, before you add it.",
  },
  {
    targets: ["filters"],
    title: "Switch between views",
    body: "See everything, just what's left, or what's done. The numbers keep count.",
  },
  {
    targets: ["tasks"],
    title: "Work through your tasks",
    body: "Tick the circle to complete a task. Click a task to edit its details and description, and drag to reorder.",
  },
  {
    targets: ["sidebar", "menu"],
    title: "Find things fast",
    bodyFor: {
      sidebar: "Search (⌘/Ctrl K), Today and Upcoming, your tags and Trash all live in the sidebar. Drag its edge to resize it.",
      menu: "Search, Today and Upcoming, your tags and Trash are all in the menu.",
    },
    body: "Search, Today and Upcoming, your tags and Trash all live in the sidebar.",
  },
  {
    targets: ["theme"],
    title: "Light or dark",
    body: "Switch themes whenever you like. greenboard remembers your choice.",
  },
  {
    targets: ["help"],
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

/** Place the card below, above, right or left of the spotlight, whichever fits first. */
function cardPosition(spot: Rect | null, card: { width: number; height: number }): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - card.width - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - card.height - EDGE);

  if (!spot) return { left: clampX((vw - card.width) / 2), top: clampY((vh - card.height) / 2) };

  const below = spot.top + spot.height + GAP;
  const above = spot.top - GAP - card.height;
  const right = spot.left + spot.width + GAP;
  const left = spot.left - GAP - card.width;

  if (below + card.height <= vh - EDGE) return { left: clampX(spot.left), top: below };
  if (above >= EDGE) return { left: clampX(spot.left), top: above };
  if (right + card.width <= vw - EDGE) return { left: right, top: clampY(spot.top) };
  if (left >= EDGE) return { left, top: clampY(spot.top) };
  // Nothing fits (a tall target on a small screen): pin to the bottom.
  return { left: clampX((vw - card.width) / 2), top: vh - card.height - EDGE };
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

  const position = typeof window === "undefined" ? {} : cardPosition(spot, cardSize);

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      {/* Blocks the page while touring; the spotlight's shadow does the dimming. */}
      <div aria-hidden className="absolute inset-0" />

      <div
        aria-hidden
        // With no target it shrinks to a point in the middle: still dimming the page, with nothing lit.
        className={`gb-tour-spot pointer-events-none fixed rounded-2xl ${spot ? "ring-2 ring-peach/80" : ""}`}
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
        className="gb-tour-card fixed w-[min(22rem,calc(100vw-2rem))] rounded-[22px] border border-ink/10 bg-surface p-5 text-ink shadow-[0_30px_70px_-25px_rgb(20_22_34/0.6)] outline-none"
        style={position}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink/60">
            <Compass className="size-3.5 text-iris" aria-hidden />
            {index + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => tourActions.end()}
            aria-label="Skip the tour"
            title="Skip the tour (Esc)"
            className="-m-1 grid size-8 place-items-center rounded-lg text-ink/45 transition-colors hover:bg-mist hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Keyed so the text fades in on each step. */}
        <div key={index} className="gb-tour-text">
          <h2 id={titleId} className="mt-3 font-display text-lg font-bold leading-snug">
            {step.title}
          </h2>
          <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-ink/70">
            {body}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div aria-hidden className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-4 bg-iris" : i < index ? "w-1.5 bg-iris/45" : "w-1.5 bg-ink/15"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-ink/65 transition-colors hover:bg-mist hover:text-ink"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-peach transition-transform hover:-translate-y-0.5"
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
