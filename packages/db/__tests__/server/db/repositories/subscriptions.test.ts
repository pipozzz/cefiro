// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getActiveSubscriptionForUser,
  getSubscriptionForUser,
  upsertSubscription,
} from "@norish/db/repositories/subscriptions";

import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("subscriptions repository", () => {
  let userId: string;
  const testBase = new RepositoryTestBase("test_subscriptions");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();
    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const future = () => new Date(Date.now() + 60 * 60 * 1000);
  const past = () => new Date(Date.now() - 60 * 60 * 1000);

  it("upserts and reads back a subscription", async () => {
    await upsertSubscription({
      userId,
      plan: "plus",
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      currentPeriodEnd: future(),
    });

    const row = await getSubscriptionForUser(userId);

    expect(row?.plan).toBe("plus");
    expect(row?.status).toBe("active");
    expect(row?.stripeCustomerId).toBe("cus_1");
  });

  it("updates in place on a second upsert (one row per user)", async () => {
    await upsertSubscription({
      userId,
      plan: "plus",
      status: "active",
      currentPeriodEnd: future(),
    });
    await upsertSubscription({
      userId,
      plan: "family",
      status: "active",
      currentPeriodEnd: future(),
    });

    const active = await getActiveSubscriptionForUser(userId);

    expect(active?.plan).toBe("family");
  });

  it("counts active and trialing as effective", async () => {
    await upsertSubscription({
      userId,
      plan: "plus",
      status: "trialing",
      currentPeriodEnd: future(),
    });

    expect(await getActiveSubscriptionForUser(userId)).not.toBeNull();
  });

  it("keeps a canceled subscription until its paid period ends", async () => {
    await upsertSubscription({
      userId,
      plan: "plus",
      status: "canceled",
      currentPeriodEnd: future(),
    });

    expect(await getActiveSubscriptionForUser(userId)).not.toBeNull();
  });

  it("drops access once the period has ended", async () => {
    await upsertSubscription({
      userId,
      plan: "plus",
      status: "canceled",
      currentPeriodEnd: past(),
    });

    expect(await getActiveSubscriptionForUser(userId)).toBeNull();
    // The row still exists, it just no longer grants access.
    expect(await getSubscriptionForUser(userId)).not.toBeNull();
  });

  it("does not grant access for an incomplete subscription", async () => {
    await upsertSubscription({
      userId,
      plan: "plus",
      status: "incomplete",
      currentPeriodEnd: future(),
    });

    expect(await getActiveSubscriptionForUser(userId)).toBeNull();
  });
});
