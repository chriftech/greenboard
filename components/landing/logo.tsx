export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-xl bg-deep shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="#ffc9a9"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
