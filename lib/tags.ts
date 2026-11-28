/**
 * Editable tags, stored in localStorage next to the built-in Default tag
 * (TAGS in lib/tasks.ts), which can't be deleted.
 *
 * A new board starts with two starter tags, Errands and Work. They can be
 * renamed, recoloured and deleted like any other, and don't count toward the
 * MAX_CUSTOM_TAGS tags a user can create (ids "custom-…").
 */

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_TAG, TAGS, getTasks, taskActions, type TagId } from "./tasks";

export type CustomTag = { id: string; label: string; color: string };

/** How many tags a user can create, besides Default and the starter tags. */
export const MAX_CUSTOM_TAGS = 5;

/** A tag the user created (as opposed to Default or a starter tag). */
export const isCreatedTag = (id: TagId) => id.startsWith("custom-");

/** Tags a new board starts with, besides Default. */
const STARTER_TAGS: CustomTag[] = [
  { id: "errands", label: "Errands", color: "#f59e0b" },
  { id: "work", label: "Work", color: "#8b5cf6" },
];

/**
 * Tags that used to be built in. Boards saved before the starter tags keep the
 * ones their tasks use, now editable and deletable, so no task loses its tag.
 */
const FORMER_BUILT_INS: CustomTag[] = [
  { id: "work", label: "Work", color: "#8b5cf6" },
  { id: "personal", label: "Personal", color: "#f43f5e" },
  { id: "team", label: "Team", color: "#06b6d4" },
  { id: "health", label: "Health", color: "#14b8a6" },
  { id: "home", label: "Home", color: "#eab308" },
];
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

const KEY = "greenboard.tags.v2";
/** Before the starter tags: only the user's own tags were saved, under this key. */
const OLD_KEY = "greenboard.tags.v1";
const HEX_RE = /^#[0-9a-f]{6}$/i;
const EMPTY: CustomTag[] = [];

let cache: CustomTag[] | null = null;
const listeners = new Set<() => void>();

function isCustomTag(v: unknown): v is CustomTag {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    t.id.length > 0 &&
    t.id !== DEFAULT_TAG &&
    typeof t.label === "string" &&
    t.label.trim().length > 0 &&
    typeof t.color === "string" &&
    HEX_RE.test(t.color)
  );
}

const parseTags = (raw: string | null): CustomTag[] => {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isCustomTag) : [];
  } catch {
    return [];
  }
};

/** At most MAX_CUSTOM_TAGS created tags; starter and former built-in tags don't count. */
function capCreated(tags: CustomTag[]): CustomTag[] {
  let created = 0;
  const seen = new Set<string>();
  return tags.filter((t) => !seen.has(t.id) && seen.add(t.id) && (!isCreatedTag(t.id) || ++created <= MAX_CUSTOM_TAGS));
}

function load(): CustomTag[] {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(KEY);
  } catch {
    // Storage blocked: start fresh for this visit.
  }
  if (saved !== null) return capCreated(parseTags(saved));

  // First visit since the starter tags: a brand-new board gets Errands and Work;
  // an existing one keeps its own tags and the old built-in tags its tasks use.
  let oldSaved: string | null = null;
  try {
    oldSaved = window.localStorage.getItem(OLD_KEY);
  } catch {
    // Treated as a new board.
  }
  const tasks = getTasks();
  const existing = oldSaved !== null || tasks.length > 0;
  const used = new Set(tasks.map((t) => t.tag));
  const first = existing ? FORMER_BUILT_INS.filter((t) => used.has(t.id)) : STARTER_TAGS;
  const tags = capCreated([...first, ...parseTags(oldSaved).filter((t) => isCreatedTag(t.id))]);
  // Save straight away, so tags deleted later stay deleted.
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tags));
  } catch {
    // Storage blocked: the tags still apply for this visit.
  }
  return tags;
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
    if (tags.filter((t) => isCreatedTag(t.id)).length >= MAX_CUSTOM_TAGS || tagLabelError(label) || !HEX_RE.test(color)) return null;
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

/** Default followed by the editable tags (starter and created), kept in sync with storage. */
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
