import { beforeEach, describe, expect, it, vi } from "vitest";

import { entitlementsForPlan, UNLIMITED_ENTITLEMENTS } from "@norish/shared/lib/plans";

const getActiveSubscriptionForUser = vi.fn();

vi.mock("@norish/db/repositories/subscriptions", () => ({
  getActiveSubscriptionForUser,
}));

const consumeAiUsage = vi.fn();

vi.mock("@norish/db/repositories/ai-usage", () => ({
  consumeAiUsage,
  currentAiUsagePeriod: () => "2026-09",
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

describe("feature gating helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    getActiveSubscriptionForUser.mockReset();
  });

  it("isEntitledTo is always true when billing is off", async () => {
    mockBilling(false);
    const { isEntitledTo } = await loadEntitlements();

    expect(await isEntitledTo("user-1", "caldavSync")).toBe(true);
    expect(await isEntitledTo("user-1", "aiImageGeneration")).toBe(true);
  });

  it("isEntitledTo denies paid features on the free plan", async () => {
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue(null);
    const { isEntitledTo } = await loadEntitlements();

    expect(await isEntitledTo("user-1", "caldavSync")).toBe(false);
    expect(await isEntitledTo("user-1", "aiImageGeneration")).toBe(false);
  });

  it("isEntitledTo grants paid features on a paid plan", async () => {
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue({ plan: "plus", status: "active" });
    const { isEntitledTo } = await loadEntitlements();

    expect(await isEntitledTo("user-1", "caldavSync")).toBe(true);
  });

  it("householdMemberLimit is unlimited when billing is off, capped otherwise", async () => {
    mockBilling(false);
    const off = await loadEntitlements();
    expect(await off.householdMemberLimit("owner")).toBe(Number.POSITIVE_INFINITY);

    vi.resetModules();
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue(null);
    const on = await loadEntitlements();
    expect(await on.householdMemberLimit("owner")).toBe(
      entitlementsForPlan("free").maxHouseholdMembers
    );
  });
});

describe("consumeAiCredit", () => {
  beforeEach(() => {
    vi.resetModules();
    getActiveSubscriptionForUser.mockReset();
    consumeAiUsage.mockReset();
  });

  it("always allows and never meters when billing is off", async () => {
    mockBilling(false);
    const { consumeAiCredit } = await loadEntitlements();

    expect(await consumeAiCredit("user-1")).toBe(true);
    // Unlimited plans never touch the counter.
    expect(consumeAiUsage).not.toHaveBeenCalled();
  });

  it("meters against the plan limit and allows while under it", async () => {
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue(null);
    consumeAiUsage.mockResolvedValue(true);
    const { consumeAiCredit } = await loadEntitlements();

    expect(await consumeAiCredit("user-1")).toBe(true);
    expect(consumeAiUsage).toHaveBeenCalledWith(
      "user-1",
      "2026-09",
      entitlementsForPlan("free").aiCreditsPerMonth
    );
  });

  it("denies once the monthly limit is reached", async () => {
    mockBilling(true);
    getActiveSubscriptionForUser.mockResolvedValue(null);
    consumeAiUsage.mockResolvedValue(false);
    const { consumeAiCredit } = await loadEntitlements();

    expect(await consumeAiCredit("user-1")).toBe(false);
  });
});
