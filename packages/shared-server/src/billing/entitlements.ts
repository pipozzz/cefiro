import type { Entitlements, PlanId } from "@norish/shared/lib/plans";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
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
