import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Follow edge state. `accepted` is an active follow; `pending` is a follow
 * request awaiting the followee's approval (only ever created for a private
 * profile). Public follows are `accepted` immediately.
 */
export const followStatusEnum = pgEnum("follow_status", ["pending", "accepted"]);

/**
 * Social follow graph (cefiro). A directed edge: `followerId` follows
 * `followeeId`. Both reference `user.id` (text). A user may not follow the
 * same person twice (unique), and self-follows are rejected in the write path.
 *
 * `status` gates the edge: only `accepted` edges count as followers, fill the
 * feed and unlock a private profile's recipes; `pending` is a request the
 * followee can accept or decline. Existing rows default to `accepted`.
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
    status: followStatusEnum("status").notNull().default("accepted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_follows_follower_followee").on(t.followerId, t.followeeId),
    index("idx_follows_follower").on(t.followerId),
    index("idx_follows_followee").on(t.followeeId),
    // Cheap "pending requests for me" lookups (the requests inbox + its badge).
    index("idx_follows_followee_status").on(t.followeeId, t.status),
  ]
);
