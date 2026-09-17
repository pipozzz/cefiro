import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getActiveSubscriptionForUser } from "@norish/db/repositories/subscriptions";
import { resolveEntitlements } from "@norish/shared-server/billing/entitlements";
import {
  getStripe,
  isStripeConfigured,
  priceIdForPlan,
} from "@norish/shared-server/billing/stripe";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const PaidPlanSchema = z.enum(["plus", "family"]);

/**
 * The caller's current plan. Only the plan id and whether billing is on cross
 * the wire; the entitlements themselves live in `@norish/shared/lib/plans`,
 * which the client imports directly (so `Infinity` limits never serialize).
 */
const getMyEntitlements = authedProcedure.query(async ({ ctx }) => {
  const { planId } = await resolveEntitlements(ctx.user.id);

  return { planId, billingEnabled: SERVER_CONFIG.BILLING_ENABLED };
});

/** Start a Stripe Checkout for a paid plan; returns the URL to redirect to. */
const createCheckoutSession = authedProcedure
  .input(z.object({ plan: PaidPlanSchema }))
  .mutation(async ({ ctx, input }) => {
    if (!isStripeConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing is not configured" });
    }

    const priceId = priceIdForPlan(input.plan);

    if (!priceId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This plan is not available" });
    }

    const baseUrl = SERVER_CONFIG.AUTH_URL;
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: ctx.user.id,
      customer_email: ctx.user.email ?? undefined,
      // Stamp the user on the subscription so every later webhook can attach it.
      subscription_data: { metadata: { userId: ctx.user.id } },
      success_url: `${baseUrl}/settings?billing=success`,
      cancel_url: `${baseUrl}/settings?billing=cancel`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create checkout session",
      });
    }

    log.info({ userId: ctx.user.id, plan: input.plan }, "Created Stripe checkout session");

    return { url: session.url };
  });

/** Open the Stripe billing portal so the user can manage or cancel. */
const createPortalSession = authedProcedure.mutation(async ({ ctx }) => {
  if (!isStripeConfigured()) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing is not configured" });
  }

  const subscription = await getActiveSubscriptionForUser(ctx.user.id);

  if (!subscription?.stripeCustomerId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription to manage" });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${SERVER_CONFIG.AUTH_URL}/settings`,
  });

  return { url: session.url };
});

export const billingRouter = router({
  getMyEntitlements,
  createCheckoutSession,
  createPortalSession,
});
