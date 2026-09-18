import type { Entitlements, PlanId } from "@norish/shared/lib/plans";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { consumeAiUsage, currentAiUsagePeriod } from "@norish/db/repositories/ai-usage";
import { getActiveSubscriptionForUser } from "@norish/db/repositories/subscriptions";
import { entitlementsForPlan, isPlanId, UNLIMITED_ENTITLEMENTS } from "@norish/shared/lib/plans";

/** Whether paid entitlement gating is active on this instance. */
export function isBillingEnabled(): boolean {
  return SERVER_CONFIG.BILLING_ENABLED;
}

export interface ResolvedEntitlements {
  /** The resolved plan, or "unlimited" when billing is off (self-hosted). */
  planId: PlanId | "unlimited";
  entitlements: Entitlements;
}

/**
 * Resolve what a user is entitled to. When billing is disabled every user is
 * unlimited (the self-hosted default), so gating callers can rely on this one
 * function without special-casing self-hosting. When billing is on, an active
 * subscription grants its plan; otherwise the user is on free.
 */
export async function resolveEntitlements(userId: string): Promise<ResolvedEntitlements> {
  if (!isBillingEnabled()) {
    return { planId: "unlimited", entitlements: UNLIMITED_ENTITLEMENTS };
  }

  const subscription = await getActiveSubscriptionForUser(userId);
  const planId: PlanId = subscription && isPlanId(subscription.plan) ? subscription.plan : "free";

  return { planId, entitlements: entitlementsForPlan(planId) };
}

/** The boolean, per-feature entitlements callers gate on. */
export type BooleanFeature = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/**
 * Whether a user may use a boolean feature. Always true when billing is off, so
 * gating callers never need to special-case self-hosting.
 */
export async function isEntitledTo(userId: string, feature: BooleanFeature): Promise<boolean> {
  const { entitlements } = await resolveEntitlements(userId);

  return entitlements[feature];
}

/**
 * The household member cap that governs `ownerUserId`'s household. The owner's
 * plan sets the size (a family plan is a shared subscription), so an invite is
 * checked against the *owner's* entitlement, not the joiner's.
 */
export async function householdMemberLimit(ownerUserId: string): Promise<number> {
  const { entitlements } = await resolveEntitlements(ownerUserId);

  return entitlements.maxHouseholdMembers;
}

/**
 * Try to consume one monthly AI credit (a URL/paste/image/video import or an
 * enrichment) for a user. Returns true if allowed — and, when metered, records
 * the use. Unlimited plans and billing-disabled instances always allow and
 * never touch the counter, so self-hosting is unmetered.
 */
export async function consumeAiCredit(userId: string): Promise<boolean> {
  const { entitlements } = await resolveEntitlements(userId);

  if (entitlements.aiCreditsPerMonth === Number.POSITIVE_INFINITY) {
    return true;
  }

  return consumeAiUsage(userId, currentAiUsagePeriod(), entitlements.aiCreditsPerMonth);
}
