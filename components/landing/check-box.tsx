/** Round checkbox whose checkmark draws itself when `done` flips on. */
export function CheckBox({ done, size = 24 }: { done: boolean; size?: number }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border-2 transition-all duration-300 ${
        done
          ? "scale-110 border-iris bg-iris shadow-[0_0_0_6px_rgb(79_107_237/0.15)]"
          : "border-ink/25 bg-white"
      }`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        className="gb-draw"
        data-done={done || undefined}
        style={{ width: size * 0.62, height: size * 0.62 }}
        fill="none"
        stroke="white"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
      </svg>
    </span>
  );
}

const COLORS = ["#ffc9a9", "#4f6bed", "#ff6f59", "#ffc845", "#4ab4ff", "#9a6bff"];

/** 14 deterministic confetti pieces bursting outwards. */
export const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const dist = 46 + (i % 3) * 18;
  return {
    x: `${Math.round(Math.cos(angle) * dist)}px`,
    y: `${Math.round(Math.sin(angle) * dist)}px`,
    r: `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
  };
});

export function ConfettiBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="gb-confetti"
          style={
            {
              "--x": c.x,
              "--y": c.y,
              "--r": c.r,
              background: c.color,
              borderRadius: c.round ? 999 : 2,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
