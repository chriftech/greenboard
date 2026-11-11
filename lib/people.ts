/**
 * People tasks can be assigned to. There are no accounts yet, so this is a
 * simple list kept in localStorage: "Me" is always there, and anyone else is
 * added by name from the assignee picker.
 */

import { useMemo, useSyncExternalStore } from "react";
import { taskActions } from "./tasks";

export type Person = { id: string; name: string };

export const ME: Person = { id: "me", name: "Me" };
export const MAX_PERSON_NAME = 30;

const KEY = "greenboard.people.v1";
const EMPTY: Person[] = [];

let cache: Person[] | null = null;
const listeners = new Set<() => void>();

function isPerson(v: unknown): v is Person {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === "string" && p.id.startsWith("person-") && typeof p.name === "string" && !!p.name.trim();
}

function load(): Person[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isPerson) : [];
  } catch {
    return [];
  }
}

function save(next: Person[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the list lasts for this visit only.
  }
  listeners.forEach((l) => l());
}

/** People added by the user (not including "Me"). */
export function getPeople(): Person[] {
  if (cache === null) cache = load();
  return cache;
}

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

export const peopleActions = {
  /**
   * Add someone by name and return their id. If a person with that name
   * already exists (or it's "me"), their existing id is returned instead.
   */
  add(name: string): string | null {
    const clean = name.trim().slice(0, MAX_PERSON_NAME);
    if (!clean) return null;
    if (clean.toLowerCase() === ME.name.toLowerCase()) return ME.id;
    const existing = getPeople().find((p) => p.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;
    const id = `person-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    save([...getPeople(), { id, name: clean }]);
    return id;
  },
  /** Remove someone from the list. Their tasks become unassigned. */
  remove(id: string) {
    save(getPeople().filter((p) => p.id !== id));
    taskActions.unassign(id);
  },
};

/** "Me" first, then everyone the user has added. */
export function usePeople(): Person[] {
  const people = useSyncExternalStore(subscribe, getPeople, () => EMPTY);
  return useMemo(() => [ME, ...people], [people]);
}

/** The person with this id, or undefined if unassigned or since removed. */
export function findPerson(people: Person[], id: string | undefined): Person | undefined {
  return id ? people.find((p) => p.id === id) : undefined;
}

/** Up to two initials, e.g. "Sam Lee" → "SL", "Me" → "ME". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#e11d48", "#84cc16"];

/** A stable colour per person, so their avatar looks the same everywhere. */
export function avatarColor(person: Person) {
  if (person.id === ME.id) return "#4f6bed";
  let hash = 0;
  for (const ch of person.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
