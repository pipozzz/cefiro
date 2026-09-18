import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Per-user monthly AI-action counter: URL/paste/image/video imports and
 * enrichment. `period` is a calendar month "YYYY-MM" in UTC, so one row holds a
 * user's usage for that month; `used` is how many actions they have consumed.
 *
 * Only written when billing is on — a billing-disabled (self-hosted) instance
 * treats AI as unmetered and never touches this table (see consumeAiCredit).
 */
export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    used: integer("used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period] })]
);

export type AiUsage = typeof aiUsage.$inferSelect;
export type NewAiUsage = typeof aiUsage.$inferInsert;
