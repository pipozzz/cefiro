import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * A record that a user accepted the Terms of Service + Privacy Policy at a given
 * version (see `LEGAL_VERSION`). Written once per user per version at sign-up.
 * Kept in its own table rather than on the (encrypted, auth-owned) user record,
 * so the consent trail is append-only and decoupled from authentication.
 */
export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The `LEGAL_VERSION` the user accepted. */
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_legal_acceptance_user_version").on(t.userId, t.version)]
);

export type LegalAcceptance = typeof legalAcceptances.$inferSelect;
export type NewLegalAcceptance = typeof legalAcceptances.$inferInsert;
