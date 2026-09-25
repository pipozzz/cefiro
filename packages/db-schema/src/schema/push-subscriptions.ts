import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * A browser Web Push subscription for a user (one row per browser/device that
 * opted in). `endpoint` is the push service URL and is unique — re-subscribing
 * the same browser upserts on it. `p256dh` and `auth` are the subscription's
 * encryption keys, needed to send an encrypted payload. Rows are pruned when the
 * push service reports the subscription gone (404/410).
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_push_subscriptions_user").on(t.userId)]
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
