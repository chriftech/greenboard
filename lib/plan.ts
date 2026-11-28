/**
 * Which plan the person using the board is on, and what it allows.
 *
 * Guests and signed-in accounts that haven't paid are on Free. A paid plan comes
 * from the account's Firebase custom claim `plan` ("standard" or "premium"), set
 * on the server once a payment goes through (see lib/auth.ts).
 */

import { getAuthState, useAuth, type AuthState } from "./auth";

export type PlanId = "free" | "standard" | "premium";
export type PaidPlan = Exclude<PlanId, "free">;

export const PLAN_NAMES: Record<PlanId, string> = { free: "Free", standard: "Standard", premium: "Premium" };

export type PlanLimits = {
  /** Columns the user can add, besides Todo and Completed. */
  extraColumns: number;
  /** Tags the user can create, besides Default and the starter tags. */
  createdTags: number;
  /** How long a deleted task stays in Trash before it's deleted for good. */
  trashDays: number;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { extraColumns: 2, createdTags: 5, trashDays: 30 },
  standard: { extraColumns: 12, createdTags: Infinity, trashDays: 90 },
  premium: { extraColumns: Infinity, createdTags: Infinity, trashDays: 365 },
};

/** The longest any plan keeps Trash: used before the account's plan is known, so nothing is deleted too soon. */
export const LONGEST_TRASH_DAYS = PLAN_LIMITS.premium.trashDays;

/** The plan with more room than this one, or null on the top plan. */
export const NEXT_PLAN: Record<PlanId, PaidPlan | null> = { free: "standard", standard: "premium", premium: null };

const planOf = (state: AuthState): PlanId => (state.status === "signed-in" ? state.user.plan : "free");

/** The current plan, outside React (stores checking a limit). */
export const getPlan = (): PlanId => planOf(getAuthState());
export const getLimits = (): PlanLimits => PLAN_LIMITS[getPlan()];

/** The current plan; re-renders when the account or its plan changes. */
export function usePlan(): PlanId {
  return planOf(useAuth());
}
export function useLimits(): PlanLimits {
  return PLAN_LIMITS[usePlan()];
}
