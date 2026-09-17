import { beforeEach, describe, expect, it, vi } from "vitest";

import { entitlementsForPlan, UNLIMITED_ENTITLEMENTS } from "@norish/shared/lib/plans";

const getActiveSubscriptionForUser = vi.fn();

vi.mock("@norish/db/repositories/subscriptions", () => ({
  getActiveSubscriptionForUser,
}));

function mockBilling(enabled: boolean) {
  vi.doMock("@norish/config/env-config-server", () => ({
    SERVER_CONFIG: { BILLING_ENABLED: enabled },
  }));
}

async function loadEntitlements() {
  return import("@norish/shared-server/billing/entitlements");
}

describe("resolveEntitlements", () => {
  beforeEach(() => {
    vi.resetModules();
    getActiveSubscriptionForUser.mockReset();
  });

  it("grants everyone unlimited access when billing is disabled", async () => {
    mockBilling(false);
    const { resolveEntitlements, isBillingEnabled } = await loadEntitlements();

    expect(isBillingEnabled()).toBe(false);

    const result = await resolveEntitlements("user-1");

    expect(result).toEqual({ planId: "unlimited", entitlements: UNLIMITED_ENTITLEMENTS });
    // No subscription lookup when billing is off.
    expect(getActiveSubscriptionForUser).not.toHaveBeenCalled();
  });

  it("falls back to the free plan when billing is on and there is no subscription", async () => {
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue(null);
    const { resolveEntitlements } = await loadEntitlements();

    const result = await resolveEntitlements("user-1");

    expect(result.planId).toBe("free");
    expect(result.entitlements).toEqual(entitlementsForPlan("free"));
  });

  it("grants the subscribed plan's entitlements", async () => {
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue({ plan: "plus", status: "active" });
    const { resolveEntitlements } = await loadEntitlements();

    const result = await resolveEntitlements("user-1");

    expect(result.planId).toBe("plus");
    expect(result.entitlements).toEqual(entitlementsForPlan("plus"));
    expect(result.entitlements.caldavSync).toBe(true);
  });

  it("treats an unknown plan value as free", async () => {
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue({ plan: "enterprise", status: "active" });
    const { resolveEntitlements } = await loadEntitlements();

    const result = await resolveEntitlements("user-1");

    expect(result.planId).toBe("free");
  });
});
