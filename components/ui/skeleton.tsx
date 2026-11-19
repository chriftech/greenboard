import type { HTMLAttributes, ReactNode } from "react";

/**
 * A grey placeholder shaped like the content that's on its way. Size and round it
 * with classes (`h-4 w-32`, `size-9 rounded-xl`, …). It pulses gently, and holds
 * still for people who ask their device for less motion.
 */
export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-full bg-ink/10 motion-reduce:animate-none ${className}`}
      {...props}
    />
  );
}

/**
 * Wraps a group of skeletons so screen readers hear one "Loading …" message
 * instead of nothing (the shapes themselves are hidden from them).
 */
export function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
