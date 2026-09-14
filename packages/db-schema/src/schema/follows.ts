import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Social follow graph (cefiro). A directed edge: `followerId` follows
 * `followeeId`. Both reference `user.id` (text). A user may not follow the
 * same person twice (unique), and self-follows are rejected in the write path.
 */
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_follows_follower_followee").on(t.followerId, t.followeeId),
    index("idx_follows_follower").on(t.followerId),
    index("idx_follows_followee").on(t.followeeId),
  ]
);
