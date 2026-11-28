"use client";

import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const COLORS = ["#16a34a", "#ffc9a9", "#4f6bed", "#ffc845", "#4ab4ff", "#22c55e", "#ff7a6b"];
const PIECES = 90;
/** How long the shower lasts, longest piece included (ms): the last piece starts at 2.7s and falls for up to 10.8s. */
const DURATION = 18200;

/** A small deterministic "random" in [0, 1), so every shower looks the same and renders stably. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const CONFETTI = Array.from({ length: PIECES }, (_, i) => ({
  left: `${(rand(i, 1) * 100).toFixed(2)}%`,
  // Sideways drift while falling, and how far it spins.
  x: `${Math.round((rand(i, 2) - 0.5) * 160)}px`,
  r: `${Math.round((rand(i, 3) - 0.5) * 1440)}deg`,
  delay: `${Math.round(rand(i, 4) * 3600)}ms`,
  duration: `${Math.round(9600 + rand(i, 5) * 4800)}ms`,
  width: 6 + Math.round(rand(i, 6) * 6),
  tall: rand(i, 7) > 0.5,
  round: i % 5 === 0,
  color: COLORS[i % COLORS.length],
}));

/**
 * Confetti falling from the top of the screen over everything, then gone. Purely decorative
 * (clicks pass through), and skipped for people who ask for reduced motion.
 */
export function ConfettiRain({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, DURATION);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div aria-hidden className="gb-rain pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="gb-rain-piece"
          style={
            {
              left: c.left,
              width: c.width,
              height: c.tall ? c.width * 1.8 : c.width,
              background: c.color,
              borderRadius: c.round ? 999 : 2,
              animationDelay: c.delay,
              animationDuration: c.duration,
              "--x": c.x,
              "--r": c.r,
            } as CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  );
}
