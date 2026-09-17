// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { householdsRouter } from "@norish/trpc/routers/households/households";

import { createMockAuthedContext, createMockUser } from "../calendar/test-utils";

const householdDb = vi.hoisted(() => ({
  addUserToHousehold: vi.fn(),
  createHousehold: vi.fn(),
  createHouseholdInvite: vi.fn(),
  findHouseholdByJoinCode: vi.fn(),
  getAllergiesForUsers: vi.fn(),
  getHouseholdById: vi.fn(),
  getHouseholdForUser: vi.fn(),
  getHouseholdInviteByToken: vi.fn(),
  getUsersByHouseholdId: vi.fn(),
  isUserHouseholdAdmin: vi.fn(),
  kickUserFromHousehold: vi.fn(),
  listPendingHouseholdInvites: vi.fn(),
  markHouseholdInviteAccepted: vi.fn(),
  regenerateJoinCode: vi.fn(),
  removeUserFromHousehold: vi.fn(),
  revokeHouseholdInvite: vi.fn(),
  transferHouseholdAdmin: vi.fn(),
}));

const mailer = vi.hoisted(() => ({
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@norish/db", () => householdDb);
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { AUTH_URL: "https://cefiro.example" },
}));
vi.mock("@norish/shared-server/email/mailer", () => mailer);
vi.mock("@norish/shared-server/email/templates/household-invite", () => ({
  buildHouseholdInviteEmail: () => ({ subject: "Invite", html: "<p>x</p>" }),
}));
vi.mock("@norish/shared-server/cache/household", () => ({
  invalidateHouseholdCache: vi.fn(),
  invalidateHouseholdCacheForUsers: vi.fn(),
}));
vi.mock("@norish/trpc/routers/households/emitter", () => ({
  householdEmitter: { emitToHousehold: vi.fn(), emitToUser: vi.fn() },
}));
vi.mock("@norish/trpc/routers/permissions/emitter", () => ({
  permissionsEmitter: { emitToUser: vi.fn() },
}));
vi.mock("@norish/trpc/connection-manager", () => ({ emitConnectionInvalidation: vi.fn() }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "household" }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const adminUser = createMockUser({ id: "admin-id", name: "Admin" });
const adminCtx = createMockAuthedContext(adminUser);
const adminCaller = householdsRouter.createCaller({ ...adminCtx, multiplexer: null } as never);

const adminHousehold = {
  id: "house-1",
  name: "The Kitchen",
  adminUserId: adminUser.id,
  users: [{ id: adminUser.id, name: "Admin", version: 1 }],
} as never;

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  householdDb.getHouseholdForUser.mockResolvedValue(adminHousehold);
  householdDb.getAllergiesForUsers.mockResolvedValue([]);
});

describe("household invites — inviteByEmail", () => {
  it("creates an invite and emails it when email is configured", async () => {
    mailer.isEmailConfigured.mockReturnValue(true);
    mailer.sendEmail.mockResolvedValue({ sent: true });
    householdDb.createHouseholdInvite.mockResolvedValue({
      invite: { id: "inv-1", email: "guest@example.com", expiresAt: future() },
      token: "raw-token",
    });

    const result = await adminCaller.inviteByEmail({ email: "Guest@Example.com" });

    expect(householdDb.createHouseholdInvite).toHaveBeenCalledWith({
      householdId: "house-1",
      email: "Guest@Example.com",
      invitedByUserId: adminUser.id,
    });
    expect(mailer.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guest@example.com" })
    );
    expect(result.emailed).toBe(true);
    expect(result.link).toBe("https://cefiro.example/invite/raw-token");
  });

  it("still returns a shareable link when email is not configured", async () => {
    mailer.isEmailConfigured.mockReturnValue(false);
    householdDb.createHouseholdInvite.mockResolvedValue({
      invite: { id: "inv-2", email: "guest@example.com", expiresAt: future() },
      token: "tok2",
    });

    const result = await adminCaller.inviteByEmail({ email: "guest@example.com" });

    expect(mailer.sendEmail).not.toHaveBeenCalled();
    expect(result.emailed).toBe(false);
    expect(result.link).toContain("/invite/tok2");
  });

  it("rejects a non-admin", async () => {
    householdDb.getHouseholdForUser.mockResolvedValue({
      ...(adminHousehold as object),
      adminUserId: "someone-else",
    });

    await expect(adminCaller.inviteByEmail({ email: "guest@example.com" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(householdDb.createHouseholdInvite).not.toHaveBeenCalled();
  });

  it("rejects when the caller has no household", async () => {
    householdDb.getHouseholdForUser.mockResolvedValue(null);

    await expect(adminCaller.inviteByEmail({ email: "guest@example.com" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects an invalid email at the input boundary", async () => {
    await expect(adminCaller.inviteByEmail({ email: "not-an-email" })).rejects.toBeTruthy();
  });
});

describe("household invites — list & revoke", () => {
  it("lists pending invites for the admin", async () => {
    const created = future();
    householdDb.listPendingHouseholdInvites.mockResolvedValue([
      { id: "inv-1", email: "a@b.com", expiresAt: created, createdAt: created },
    ]);

    const result = await adminCaller.listInvites();

    expect(result.invites).toEqual([
      {
        id: "inv-1",
        email: "a@b.com",
        expiresAt: created.toISOString(),
        createdAt: created.toISOString(),
      },
    ]);
  });

  it("returns an empty list for non-admins", async () => {
    householdDb.getHouseholdForUser.mockResolvedValue({
      ...(adminHousehold as object),
      adminUserId: "someone-else",
    });

    const result = await adminCaller.listInvites();

    expect(result.invites).toEqual([]);
    expect(householdDb.listPendingHouseholdInvites).not.toHaveBeenCalled();
  });

  it("revokes an existing invite", async () => {
    householdDb.revokeHouseholdInvite.mockResolvedValue(true);

    await expect(adminCaller.revokeInvite({ inviteId: crypto.randomUUID() })).resolves.toEqual({
      success: true,
    });
  });

  it("404s when revoking an unknown invite", async () => {
    householdDb.revokeHouseholdInvite.mockResolvedValue(false);

    await expect(adminCaller.revokeInvite({ inviteId: crypto.randomUUID() })).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
  });
});

describe("household invites — getInvite & acceptInvite", () => {
  it("previews a valid pending invite", async () => {
    householdDb.getHouseholdInviteByToken.mockResolvedValue({
      id: "inv-1",
      householdId: "house-1",
      status: "pending",
      expiresAt: future(),
      email: "guest@example.com",
    });
    householdDb.getHouseholdById.mockResolvedValue({ id: "house-1", name: "The Kitchen" });

    const result = await adminCaller.getInvite({ token: "tok" });

    expect(result.invite).toEqual({ householdName: "The Kitchen" });
  });

  it("returns null for an expired invite", async () => {
    householdDb.getHouseholdInviteByToken.mockResolvedValue({
      id: "inv-1",
      householdId: "house-1",
      status: "pending",
      expiresAt: past(),
      email: "guest@example.com",
    });

    const result = await adminCaller.getInvite({ token: "tok" });

    expect(result.invite).toBeNull();
  });

  it("accepts a valid invite and joins the household", async () => {
    const joiner = createMockUser({ id: "joiner-id", name: "Joiner" });
    const joinerCtx = createMockAuthedContext(joiner);
    const joinerCaller = householdsRouter.createCaller({
      ...joinerCtx,
      multiplexer: null,
    } as never);

    householdDb.getHouseholdInviteByToken.mockResolvedValue({
      id: "inv-1",
      householdId: "house-1",
      status: "pending",
      expiresAt: future(),
      email: "joiner@example.com",
    });
    // First call: existing-household check (none). Second: dto after joining.
    householdDb.getHouseholdForUser.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...(adminHousehold as object),
      users: [{ id: joiner.id, name: "Joiner", version: 1 }],
    });
    householdDb.getUsersByHouseholdId.mockResolvedValue([{ userId: adminUser.id }]);
    householdDb.addUserToHousehold.mockResolvedValue({ version: 1 });

    const result = await joinerCaller.acceptInvite({ token: "tok" });

    expect(result).toEqual({ householdId: "house-1" });
    expect(householdDb.addUserToHousehold).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: joiner.id,
    });
    expect(householdDb.markHouseholdInviteAccepted).toHaveBeenCalledWith("inv-1", joiner.id);
  });

  it("rejects an expired invite on accept", async () => {
    householdDb.getHouseholdInviteByToken.mockResolvedValue({
      id: "inv-1",
      householdId: "house-1",
      status: "pending",
      expiresAt: past(),
      email: "guest@example.com",
    });

    await expect(adminCaller.acceptInvite({ token: "tok" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(householdDb.addUserToHousehold).not.toHaveBeenCalled();
  });

  it("rejects accepting while already in a household", async () => {
    householdDb.getHouseholdInviteByToken.mockResolvedValue({
      id: "inv-1",
      householdId: "house-2",
      status: "pending",
      expiresAt: future(),
      email: "guest@example.com",
    });
    householdDb.getHouseholdForUser.mockResolvedValue(adminHousehold);

    await expect(adminCaller.acceptInvite({ token: "tok" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
