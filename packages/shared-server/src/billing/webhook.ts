import type Stripe from "stripe";

import { upsertSubscription } from "@norish/db/repositories/subscriptions";
import { serverLogger as log } from "@norish/shared-server/logger";

import { planForPriceId } from "./stripe";

/** Unix-seconds period end, tolerating both the legacy top-level field and the
 * newer per-item location across Stripe API versions. */
function periodEnd(subscription: Stripe.Subscription): Date | null {
  const top = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const perItem = (
    subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  )?.current_period_end;
  const raw = top ?? perItem;

  return typeof raw === "number" ? new Date(raw * 1000) : null;
}

function customerId(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer;

  return typeof customer === "string" ? customer : (customer?.id ?? null);
}

async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId =
    typeof subscription.metadata?.userId === "string" ? subscription.metadata.userId : null;

  if (!userId) {
    // Nothing to attach it to — a subscription created outside our checkout.
    log.warn(
      { subscriptionId: subscription.id },
      "Stripe subscription has no userId metadata; skipping"
    );

    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const plan = planForPriceId(priceId);

  if (!plan) {
    log.warn(
      { subscriptionId: subscription.id, priceId },
      "Stripe subscription price does not map to a known plan; skipping"
    );

    return;
  }

  await upsertSubscription({
    userId,
    plan,
    status: subscription.status,
    stripeCustomerId: customerId(subscription),
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: periodEnd(subscription),
  });

  log.info({ userId, plan, status: subscription.status }, "Applied Stripe subscription");
}

/**
 * Apply a verified Stripe event to the local subscription projection. Only
 * subscription-lifecycle events matter — the subscription object carries the
 * plan, status and period, so a single handler covers create / update / delete.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object);
      break;
    default:
      // Other events (invoices, payment intents, …) need no local change.
      break;
  }
}
