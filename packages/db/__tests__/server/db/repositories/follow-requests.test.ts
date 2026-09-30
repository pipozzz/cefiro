// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  acceptFollowRequest,
  countPendingFollowRequests,
  declineFollowRequest,
  followUser,
  getFollowCounts,
  getFollowRelation,
  isFollowing,
  listPendingFollowRequests,
} from "@norish/db/repositories/follows";
import * as schema from "@norish/db/schema";

import { createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("follow requests", () => {
  let ownerId: string;
  const testBase = new RepositoryTestBase("test_follow_requests");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();
    ownerId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function createProfile(userId: string, handle: string) {
    await getTestDb().insert(schema.userProfiles).values({ userId, handle });
  }

  it("a public follow is accepted immediately and counts", async () => {
    const target = await createTestUser();
    await createProfile(target.id, "target");

    const relation = await followUser(ownerId, target.id, "accepted");

    expect(relation).toBe("accepted");
    expect(await isFollowing(ownerId, target.id)).toBe(true);
    expect((await getFollowCounts(target.id)).followers).toBe(1);
  });

  it("a private follow is pending: not a follower yet, and shows in the inbox", async () => {
    await createProfile(ownerId, "owner");
    const requester = await createTestUser();
    await createProfile(requester.id, "requester");

    const relation = await followUser(requester.id, ownerId, "pending");

    expect(relation).toBe("pending");
    // A pending request is not an active follow and is not counted.
    expect(await isFollowing(requester.id, ownerId)).toBe(false);
    expect((await getFollowCounts(ownerId)).followers).toBe(0);
    expect(await countPendingFollowRequests(ownerId)).toBe(1);

    const requests = await listPendingFollowRequests(ownerId);

    expect(requests.map((r) => r.handle)).toEqual(["requester"]);
  });

  it("accepting a request turns it into an active follow", async () => {
    const requester = await createTestUser();
    await createProfile(requester.id, "requester");
    await followUser(requester.id, ownerId, "pending");

    const ok = await acceptFollowRequest(ownerId, requester.id);

    expect(ok).toBe(true);
    expect(await getFollowRelation(requester.id, ownerId)).toBe("accepted");
    expect((await getFollowCounts(ownerId)).followers).toBe(1);
    expect(await countPendingFollowRequests(ownerId)).toBe(0);
    // Accepting again is a no-op (no pending row left).
    expect(await acceptFollowRequest(ownerId, requester.id)).toBe(false);
  });

  it("declining a request removes it", async () => {
    const requester = await createTestUser();
    await createProfile(requester.id, "requester");
    await followUser(requester.id, ownerId, "pending");

    const ok = await declineFollowRequest(ownerId, requester.id);

    expect(ok).toBe(true);
    expect(await getFollowRelation(requester.id, ownerId)).toBe("none");
    expect(await countPendingFollowRequests(ownerId)).toBe(0);
  });

  it("re-following keeps the existing relation (no downgrade)", async () => {
    const requester = await createTestUser();
    await createProfile(requester.id, "requester");
    await followUser(requester.id, ownerId, "pending");
    await acceptFollowRequest(ownerId, requester.id);

    // A duplicate follow attempt must not knock an accepted edge back to pending.
    const relation = await followUser(requester.id, ownerId, "pending");

    expect(relation).toBe("accepted");
  });
});
