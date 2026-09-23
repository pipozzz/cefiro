import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { versionColumn } from "./shared";

/**
 * Admin invitations to register on this *instance* (not to a household).
 *
 * When public registration is locked, a server admin can still invite a new
 * person: this row lets exactly that email past the sign-up gate. The invitee
 * creates their own normal account and lands with no household — identical to an
 * ordinary self-service signup, just permitted by the invite. Distinct from
 * `household_invites`, which add an existing/new user to a specific household.
 *
 * Token posture mirrors household invites: the raw token lives only in the link;
 * we store its SHA-256 hash. The invited email is encrypted at rest with a
 * separate blind index for dedup lookups without decrypting.
 */
export const instanceInvites = pgTable(
  "instance_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // AES-encrypted invited email; decrypt for display / resend.
    emailEncrypted: text("email_encrypted").notNull(),
    // Deterministic HMAC of the normalized email, for dedup lookups.
    emailIndex: text("email_index").notNull(),
    // SHA-256 of the raw token; the raw token is only in the invite link.
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // "pending" | "accepted" | "revoked". Text, matching the app's other
    // low-cardinality status columns, to avoid an enum migration.
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_instance_invites_email_index").on(t.emailIndex),
    unique("uq_instance_invites_token_hash").on(t.tokenHash),
  ]
);

export type InstanceInvite = typeof instanceInvites.$inferSelect;
export type NewInstanceInvite = typeof instanceInvites.$inferInsert;
