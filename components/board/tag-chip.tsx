import type { CSSProperties } from "react";
import type { TagView } from "@/lib/tags";

/**
 * Custom tag colours are any hex. The chip mixes the colour toward the ink
 * token for its text, so it reads in both themes (darker in light mode,
 * lighter in dark mode).
 */
export const customChipStyle = (color: string): CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
  color: `color-mix(in srgb, ${color} 62%, var(--color-ink))`,
});

export function TagDot({ tag, className = "size-2" }: { tag: TagView; className?: string }) {
  return tag.custom ? (
    <span className={`shrink-0 rounded-full ${className}`} style={{ backgroundColor: tag.color }} />
  ) : (
    <span className={`shrink-0 rounded-full ${className} ${tag.dot}`} />
  );
}

export function TagChip({ tag, className = "" }: { tag: TagView; className?: string }) {
  const base = `rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`;
  return tag.custom ? (
    <span className={base} style={customChipStyle(tag.color!)}>
      {tag.label}
    </span>
  ) : (
    <span className={`${base} ${tag.chip}`}>{tag.label}</span>
  );
}

/** A tag option in a radio group (new-task form and details panel). */
export function TagRadio({
  tag,
  checked,
  onSelect,
  idleClassName = "",
  checkedClassName = "",
}: {
  tag: TagView;
  checked: boolean;
  onSelect: () => void;
  /** Extra classes when not selected (e.g. a background). */
  idleClassName?: string;
  /** Extra classes when selected (e.g. a slight scale-up). */
  checkedClassName?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      style={checked && tag.custom ? customChipStyle(tag.color!) : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
        checked
          ? `${tag.custom ? "" : tag.chip} border-current ${checkedClassName}`
          : `border-ink/10 text-ink/60 hover:border-ink/25 ${idleClassName}`
      }`}
    >
      <TagDot tag={tag} />
      {tag.label}
    </button>
  );
}
