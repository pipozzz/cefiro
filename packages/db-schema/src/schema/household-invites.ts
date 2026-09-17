import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { households } from "./households";
import { versionColumn } from "./shared";

/**
 * Email invitations to a household. The raw invite token lives only in the
 * emailed link; we store its hash (like recipe-share tokens). The invited email
 * is encrypted at rest, matching the app's PII posture, with a separate blind
 * index so a pending invite can be looked up by email without decrypting.
 */
export const householdInvites = pgTable(
  "household_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // AES-encrypted invited email; decrypt for display / resend.
    emailEncrypted: text("email_encrypted").notNull(),
    // Deterministic HMAC of the normalized email, for dedup lookups.
    emailIndex: text("email_index").notNull(),
    // SHA-256 of the raw token; the raw token is only in the emailed link.
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
    index("idx_household_invites_household_id").on(t.householdId),
    index("idx_household_invites_email_index").on(t.emailIndex),
    unique("uq_household_invites_token_hash").on(t.tokenHash),
  ]
);

export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type NewHouseholdInvite = typeof householdInvites.$inferInsert;
