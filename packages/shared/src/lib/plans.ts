/**
 * Subscription plans and the entitlements they grant.
 *
 * This is isomorphic, dependency-free data: the server reads it to gate
 * features, and the client reads it to render a pricing / upgrade screen. It
 * describes WHAT each plan allows; deciding whether billing is even on, and
 * resolving a given user to a plan, lives server-side (shared-server/billing).
 *
 * Monetisation is service-side only (the app is AGPL): a self-hosted instance
 * with billing disabled treats everyone as `UNLIMITED` — see
 * `UNLIMITED_ENTITLEMENTS`. Nothing here paywalls the social graph; only
 * cost-bearing utility (AI, sync) and capacity (household size) are metered.
 */

export const PLAN_IDS = ["free", "plus", "family"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** The paid plans, i.e. everything a subscription can put someone on. */
export const PAID_PLAN_IDS = ["plus", "family"] as const;

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export interface Entitlements {
  /** AI recipe image generation (a per-call cost, so plus and up). */
  aiImageGeneration: boolean;
  /** CalDAV calendar sync. */
  caldavSync: boolean;
  /**
   * Members allowed in a household (the owner counts). `Infinity` = unlimited.
   * The "family" plan is the natural unit here — a shared subscription.
   */
  maxHouseholdMembers: number;
  /**
   * AI actions (URL/paste/image/video import + enrichment) included per calendar
   * month, metered so a heavy user can't run up an unbounded provider bill.
   * `Infinity` = unmetered.
   */
  aiCreditsPerMonth: number;
}

export interface Plan {
  id: PlanId;
  entitlements: Entitlements;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    entitlements: {
      aiImageGeneration: false,
      caldavSync: false,
      maxHouseholdMembers: 2,
      aiCreditsPerMonth: 15,
    },
  },
  plus: {
    id: "plus",
    entitlements: {
      aiImageGeneration: true,
      caldavSync: true,
      maxHouseholdMembers: 4,
      aiCreditsPerMonth: 300,
    },
  },
  family: {
    id: "family",
    entitlements: {
      aiImageGeneration: true,
      caldavSync: true,
      maxHouseholdMembers: 10,
      aiCreditsPerMonth: 800,
    },
  },
};

/**
 * What a billing-disabled (self-hosted) instance grants everyone: everything,
 * unmetered. Keeping this separate from the paid plans means self-hosting is
 * never accidentally degraded by a plan-table tweak.
 */
export const UNLIMITED_ENTITLEMENTS: Entitlements = {
  aiImageGeneration: true,
  caldavSync: true,
  maxHouseholdMembers: Number.POSITIVE_INFINITY,
  aiCreditsPerMonth: Number.POSITIVE_INFINITY,
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function entitlementsForPlan(planId: PlanId): Entitlements {
  return PLANS[planId].entitlements;
}
