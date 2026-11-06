/**
 * Custom tags: up to MAX_CUSTOM_TAGS user-made tags with their own colour,
 * stored in localStorage next to the built-in TAGS from lib/tasks.ts.
 */

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_TAG, TAGS, taskActions, type TagId } from "./tasks";

export type CustomTag = { id: string; label: string; color: string };

export const MAX_CUSTOM_TAGS = 5;
export const MAX_TAG_LABEL = 20;

/** Preset swatches for the tag editor; any other colour can be picked too. */
export const TAG_COLORS = [
  "#f43f5e", // rose
  "#f97316", // orange
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // slate
  "#a16207", // brown
];

/** One shape for built-in and custom tags. Built-ins use classes; custom ones a colour. */
export type TagView = {
  id: TagId;
  label: string;
  custom: boolean;
  /** Built-in: classes for the chip and the dot. */
  chip?: string;
  dot?: string;
  /** Custom: the chosen colour (#rrggbb). */
  color?: string;
};

const KEY = "greenboard.tags.v1";
const HEX_RE = /^#[0-9a-f]{6}$/i;
const EMPTY: CustomTag[] = [];

let cache: CustomTag[] | null = null;
const listeners = new Set<() => void>();

function isCustomTag(v: unknown): v is CustomTag {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    t.id.startsWith("custom-") &&
    typeof t.label === "string" &&
    t.label.trim().length > 0 &&
    typeof t.color === "string" &&
    HEX_RE.test(t.color)
  );
}

function load(): CustomTag[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isCustomTag).slice(0, MAX_CUSTOM_TAGS) : [];
  } catch {
    return [];
  }
}

function save(next: CustomTag[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: tags last for this visit only.
  }
  listeners.forEach((l) => l());
}

export function getCustomTags(): CustomTag[] {
  if (cache === null) cache = load();
  return cache;
}

const getServerCustomTags = () => EMPTY;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Why a tag name can't be used, or null if it's fine. */
export function tagLabelError(label: string, exceptId?: string): string | null {
  const clean = label.trim();
  if (!clean) return "Give the tag a name.";
  if (clean.length > MAX_TAG_LABEL) return `Keep it under ${MAX_TAG_LABEL} characters.`;
  const taken = [...TAGS, ...getCustomTags()].some(
    (t) => t.id !== exceptId && t.label.toLowerCase() === clean.toLowerCase(),
  );
  return taken ? "A tag with this name already exists." : null;
}

export const tagActions = {
  /** Create a tag; returns its id, or null if the limit is reached or the input is invalid. */
  add(label: string, color: string): string | null {
    const tags = getCustomTags();
    if (tags.length >= MAX_CUSTOM_TAGS || tagLabelError(label) || !HEX_RE.test(color)) return null;
    const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    save([...tags, { id, label: label.trim(), color: color.toLowerCase() }]);
    return id;
  },
  update(id: string, patch: { label: string; color: string }) {
    if (tagLabelError(patch.label, id) || !HEX_RE.test(patch.color)) return;
    save(
      getCustomTags().map((t) =>
        t.id === id ? { ...t, label: patch.label.trim(), color: patch.color.toLowerCase() } : t,
      ),
    );
  },
  /** Delete a tag. Its tasks move to Default, so none are lost. */
  remove(id: string) {
    save(getCustomTags().filter((t) => t.id !== id));
    taskActions.retag(id, DEFAULT_TAG);
  },
};

/** Built-in tags followed by the user's custom tags, kept in sync with storage. */
export function useTags(): TagView[] {
  const custom = useSyncExternalStore(subscribe, getCustomTags, getServerCustomTags);
  return useMemo(
    () => [
      ...TAGS.map((t) => ({ id: t.id, label: t.label, chip: t.chip, dot: t.dot, custom: false })),
      ...custom.map((t) => ({ id: t.id, label: t.label, color: t.color, custom: true })),
    ],
    [custom],
  );
}

/** The tag with this id, falling back to Default for unknown or deleted tags. */
export function findTag(tags: TagView[], id: TagId): TagView {
  return tags.find((t) => t.id === id) ?? tags.find((t) => t.id === DEFAULT_TAG)!;
}
