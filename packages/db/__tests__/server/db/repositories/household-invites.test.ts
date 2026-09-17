// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createHouseholdInvite,
  getHouseholdInviteByToken,
  listPendingHouseholdInvites,
  markHouseholdInviteAccepted,
  revokeHouseholdInvite,
} from "@norish/db/repositories/household-invites";
import { createHousehold } from "@norish/db/repositories/households";

import { createTestUser } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("household invites", () => {
  let adminId: string;
  let householdId: string;
  const testBase = new RepositoryTestBase("test_household_invites");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();
    adminId = user.id;
    const household = await createHousehold({ name: "Test Household", adminUserId: adminId });
    householdId = household.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("stores the email encrypted and finds the invite by its raw token", async () => {
    const { invite, token } = await createHouseholdInvite({
      householdId,
      email: "Guest@Example.com",
      invitedByUserId: adminId,
    });

    // Normalised (trimmed + lowercased) and decryptable.
    expect(invite.email).toBe("guest@example.com");

    const found = await getHouseholdInviteByToken(token);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(invite.id);
    expect(found?.householdId).toBe(householdId);
    expect(found?.status).toBe("pending");
    expect(found?.email).toBe("guest@example.com");
  });

  it("returns null for an unknown token", async () => {
    await createHouseholdInvite({ householdId, email: "a@b.com", invitedByUserId: adminId });

    expect(await getHouseholdInviteByToken("not-a-real-token")).toBeNull();
  });

  it("supersedes a prior pending invite to the same email on re-invite", async () => {
    const first = await createHouseholdInvite({
      householdId,
      email: "guest@example.com",
      invitedByUserId: adminId,
    });
    const second = await createHouseholdInvite({
      householdId,
      email: "guest@example.com",
      invitedByUserId: adminId,
    });

    const pending = await listPendingHouseholdInvites(householdId);

    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(second.invite.id);
    // The old token no longer resolves to a pending invite.
    expect((await getHouseholdInviteByToken(first.token))?.status).toBe("revoked");
  });

  it("revokes a pending invite and won't revoke twice", async () => {
    const { invite } = await createHouseholdInvite({
      householdId,
      email: "guest@example.com",
      invitedByUserId: adminId,
    });

    expect(await revokeHouseholdInvite(householdId, invite.id)).toBe(true);
    expect(await listPendingHouseholdInvites(householdId)).toHaveLength(0);
    expect(await revokeHouseholdInvite(householdId, invite.id)).toBe(false);
  });

  it("marks an invite accepted so it drops out of the pending list", async () => {
    const { invite, token } = await createHouseholdInvite({
      householdId,
      email: "guest@example.com",
      invitedByUserId: adminId,
    });

    const joiner = await createTestUser();
    await markHouseholdInviteAccepted(invite.id, joiner.id);

    expect(await listPendingHouseholdInvites(householdId)).toHaveLength(0);
    expect((await getHouseholdInviteByToken(token))?.status).toBe("accepted");
  });
});
