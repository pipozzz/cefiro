import { beforeEach, describe, expect, it, vi } from "vitest";

import { inviteAllowsRegistration, runWithInviteToken } from "@norish/auth/registration-bypass";

const { getHouseholdInviteByToken, getInstanceInviteByToken } = vi.hoisted(() => ({
  getHouseholdInviteByToken: vi.fn(),
  getInstanceInviteByToken: vi.fn(),
}));

vi.mock("@norish/db/repositories/household-invites", () => ({
  getHouseholdInviteByToken,
}));

vi.mock("@norish/db/repositories/instance-invites", () => ({
  getInstanceInviteByToken,
}));

const FUTURE = () => new Date(Date.now() + 60_000);
const PAST = () => new Date(Date.now() - 60_000);

describe("inviteAllowsRegistration", () => {
  beforeEach(() => {
    getHouseholdInviteByToken.mockReset();
    getInstanceInviteByToken.mockReset();
    // Default: no matching invite in either table unless a test says otherwise.
    getHouseholdInviteByToken.mockResolvedValue(null);
    getInstanceInviteByToken.mockResolvedValue(null);
  });

  it("is false with no invite token in scope (the locked default)", async () => {
    expect(await inviteAllowsRegistration("guest@example.com")).toBe(false);
    expect(getHouseholdInviteByToken).not.toHaveBeenCalled();
  });

  it("allows a pending, unexpired, email-matched invite", async () => {
    getHouseholdInviteByToken.mockResolvedValue({
      status: "pending",
      expiresAt: FUTURE(),
      email: "Guest@Example.com",
    });

    const allowed = await runWithInviteToken("tok", () =>
      inviteAllowsRegistration("guest@example.com")
    );

    expect(allowed).toBe(true);
  });

  it("rejects a different email even with a valid token (leaked-link guard)", async () => {
    getHouseholdInviteByToken.mockResolvedValue({
      status: "pending",
      expiresAt: FUTURE(),
      email: "invited@example.com",
    });

    const allowed = await runWithInviteToken("tok", () =>
      inviteAllowsRegistration("someone-else@example.com")
    );

    expect(allowed).toBe(false);
  });

  it("rejects an expired invite", async () => {
    getHouseholdInviteByToken.mockResolvedValue({
      status: "pending",
      expiresAt: PAST(),
      email: "guest@example.com",
    });

    const allowed = await runWithInviteToken("tok", () =>
      inviteAllowsRegistration("guest@example.com")
    );

    expect(allowed).toBe(false);
  });

  it("rejects an already-accepted or revoked invite", async () => {
    getHouseholdInviteByToken.mockResolvedValue({
      status: "accepted",
      expiresAt: FUTURE(),
      email: "guest@example.com",
    });

    const allowed = await runWithInviteToken("tok", () =>
      inviteAllowsRegistration("guest@example.com")
    );

    expect(allowed).toBe(false);
  });

  it("rejects a token with no matching invite", async () => {
    getHouseholdInviteByToken.mockResolvedValue(null);

    const allowed = await runWithInviteToken("tok", () =>
      inviteAllowsRegistration("guest@example.com")
    );

    expect(allowed).toBe(false);
  });

  it("allows a pending, unexpired, email-matched instance invite", async () => {
    // No household invite for this token; an instance invite matches instead.
    getInstanceInviteByToken.mockResolvedValue({
      status: "pending",
      expiresAt: FUTURE(),
      email: "Guest@Example.com",
    });

    const allowed = await runWithInviteToken("tok", () =>
      inviteAllowsRegistration("guest@example.com")
    );

    expect(allowed).toBe(true);
  });

  it("rejects a different email even with a valid instance token (leaked-link guard)", async () => {
    getInstanceInviteByToken.mockResolvedValue({
      status: "pending",
      expiresAt: FUTURE(),
      email: "invited@example.com",
    });

    const allowed = await runWithInviteToken("tok", () =>
      inviteAllowsRegistration("someone-else@example.com")
    );

    expect(allowed).toBe(false);
  });
});
