import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { decrypt, encrypt, hashToken, hmacIndex } from "@norish/config/crypto";
import { db } from "@norish/db/drizzle";

import { instanceInvites } from "../schema";

/** Instance invites are valid for two weeks. */
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface InstanceInviteView {
  id: string;
  /** Decrypted for display to the admin who created it. */
  email: string;
  status: string;
  invitedByUserId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface InstanceInviteRecord {
  id: string;
  status: string;
  expiresAt: Date;
  email: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toView(row: typeof instanceInvites.$inferSelect): InstanceInviteView {
  return {
    id: row.id,
    email: decrypt(row.emailEncrypted),
    status: row.status,
    invitedByUserId: row.invitedByUserId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

/**
 * Create a pending instance invite and return the raw token for the link.
 * Any existing pending invite for the same email is revoked first, so
 * "invite again" refreshes the token and expiry instead of piling up.
 */
export async function createInstanceInvite(params: {
  email: string;
  invitedByUserId: string;
}): Promise<{ invite: InstanceInviteView; token: string }> {
  const email = normalizeEmail(params.email);
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db
    .update(instanceInvites)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(eq(instanceInvites.emailIndex, hmacIndex(email)), eq(instanceInvites.status, "pending"))
    );

  const [row] = await db
    .insert(instanceInvites)
    .values({
      emailEncrypted: encrypt(email),
      emailIndex: hmacIndex(email),
      tokenHash: hashToken(token),
      invitedByUserId: params.invitedByUserId,
      expiresAt,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create instance invite");
  }

  return { invite: toView(row), token };
}

/** Pending, unexpired invites, newest first. */
export async function listPendingInstanceInvites(): Promise<InstanceInviteView[]> {
  const rows = await db
    .select()
    .from(instanceInvites)
    .where(eq(instanceInvites.status, "pending"))
    .orderBy(desc(instanceInvites.createdAt));

  const now = Date.now();

  return rows.filter((row) => row.expiresAt.getTime() > now).map(toView);
}

/** Look up an invite by its raw token (from the invite link). */
export async function getInstanceInviteByToken(
  token: string
): Promise<InstanceInviteRecord | null> {
  const [row] = await db
    .select()
    .from(instanceInvites)
    .where(eq(instanceInvites.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    expiresAt: row.expiresAt,
    email: decrypt(row.emailEncrypted),
  };
}

/** Revoke a pending invite (admin action). Returns true if a row changed. */
export async function revokeInstanceInvite(inviteId: string): Promise<boolean> {
  const result = await db
    .update(instanceInvites)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(instanceInvites.id, inviteId), eq(instanceInvites.status, "pending")))
    .returning({ id: instanceInvites.id });

  return result.length > 0;
}

/** Mark an invite accepted by a user. */
export async function markInstanceInviteAccepted(inviteId: string, userId: string): Promise<void> {
  await db
    .update(instanceInvites)
    .set({
      status: "accepted",
      acceptedByUserId: userId,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(instanceInvites.id, inviteId));
}
