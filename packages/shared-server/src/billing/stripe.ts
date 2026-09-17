import Stripe from "stripe";

import type { PaidPlanId } from "@norish/shared/lib/plans";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

/** Whether a Stripe secret key is configured (checkout / portal need it). */
export function isStripeConfigured(): boolean {
  return Boolean(SERVER_CONFIG.STRIPE_SECRET_KEY);
}

let cachedClient: Stripe | null = null;

/** The Stripe client. Throws if Stripe is not configured — guard with
 * `isStripeConfigured()` first. */
export function getStripe(): Stripe {
  if (!SERVER_CONFIG.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }

  if (!cachedClient) {
    cachedClient = new Stripe(SERVER_CONFIG.STRIPE_SECRET_KEY);
  }

  return cachedClient;
}

/** Reset the cached client — used by tests. */
export function resetStripe(): void {
  cachedClient = null;
}

/** The configured Stripe Price id for a paid plan, or undefined if unset. */
export function priceIdForPlan(plan: PaidPlanId): string | undefined {
  return plan === "plus" ? SERVER_CONFIG.STRIPE_PRICE_PLUS : SERVER_CONFIG.STRIPE_PRICE_FAMILY;
}

/** Map a Stripe Price id back to a plan, or null if it is not a known plan. */
export function planForPriceId(priceId: string | null | undefined): PaidPlanId | null {
  if (!priceId) {
    return null;
  }

  if (priceId === SERVER_CONFIG.STRIPE_PRICE_PLUS) {
    return "plus";
  }

  if (priceId === SERVER_CONFIG.STRIPE_PRICE_FAMILY) {
    return "family";
  }

  return null;
}
