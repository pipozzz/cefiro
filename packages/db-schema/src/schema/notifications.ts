import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipes } from "./recipes";

export const notificationTypeEnum = pgEnum("notification_type", [
  "follow",
  "like",
  "comment",
  "save",
  "report",
]);

/**
 * In-app notifications (cefiro social layer). `userId` is the recipient,
 * `actorId` the person who triggered it. `recipeId` is set for like/comment.
 * Actor identity is displayed from `user_profiles`, never the encrypted user
 * record. Rows are removed if the recipient, actor or recipe is deleted.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_notifications_user_created").on(t.userId, t.createdAt.desc()),
    // Partial index for cheap unread counts.
    index("idx_notifications_user_unread").on(t.userId).where(sql`read_at IS NULL`),
  ]
);
