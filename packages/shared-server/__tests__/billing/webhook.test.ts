import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleStripeEvent } from "@norish/shared-server/billing/webhook";

const upsertSubscription = vi.hoisted(() => vi.fn());

vi.mock("@norish/db/repositories/subscriptions", () => ({ upsertSubscription }));
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { STRIPE_PRICE_PLUS: "price_plus", STRIPE_PRICE_FAMILY: "price_family" },
}));
vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function subscriptionEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    type,
    data: {
      object: {
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        current_period_end: 1_893_456_000,
        metadata: { userId: "user-1" },
        items: { data: [{ price: { id: "price_plus" } }] },
        ...object,
      },
    },
  } as unknown as Stripe.Event;
}

describe("handleStripeEvent", () => {
  beforeEach(() => {
    upsertSubscription.mockReset();
  });

  it("upserts a subscription from a subscription.updated event", async () => {
    await handleStripeEvent(subscriptionEvent("customer.subscription.updated", {}));

    expect(upsertSubscription).toHaveBeenCalledWith({
      userId: "user-1",
      plan: "plus",
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      currentPeriodEnd: new Date(1_893_456_000 * 1000),
    });
  });

  it("records the canceled status from a subscription.deleted event", async () => {
    await handleStripeEvent(
      subscriptionEvent("customer.subscription.deleted", { status: "canceled" })
    );

    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: "canceled", plan: "plus" })
    );
  });

  it("maps the family price to the family plan", async () => {
    await handleStripeEvent(
      subscriptionEvent("customer.subscription.created", {
        items: { data: [{ price: { id: "price_family" } }] },
      })
    );

    expect(upsertSubscription).toHaveBeenCalledWith(expect.objectContaining({ plan: "family" }));
  });

  it("reads the period end from the per-item field when the top-level one is absent", async () => {
    await handleStripeEvent(
      subscriptionEvent("customer.subscription.updated", {
        current_period_end: undefined,
        items: { data: [{ price: { id: "price_plus" }, current_period_end: 1_800_000_000 }] },
      })
    );

    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ currentPeriodEnd: new Date(1_800_000_000 * 1000) })
    );
  });

  it("skips a subscription with no userId metadata", async () => {
    await handleStripeEvent(subscriptionEvent("customer.subscription.updated", { metadata: {} }));

    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("skips a subscription whose price is not a known plan", async () => {
    await handleStripeEvent(
      subscriptionEvent("customer.subscription.updated", {
        items: { data: [{ price: { id: "price_unknown" } }] },
      })
    );

    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("ignores non-subscription events", async () => {
    await handleStripeEvent({
      type: "invoice.paid",
      data: { object: {} },
    } as unknown as Stripe.Event);

    expect(upsertSubscription).not.toHaveBeenCalled();
  });
});
