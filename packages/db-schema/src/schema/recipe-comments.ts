import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipes } from "./recipes";
import { versionColumn } from "./shared";

/**
 * Comments on a recipe (cefiro social layer). Flat (no threading) for now.
 * `userId` is the author; deleting the user or recipe removes their comments.
 * Author display is resolved from `user_profiles`, never the encrypted user
 * record, so only users with a public profile may post (enforced in the API).
 */
export const recipeComments = pgTable(
  "recipe_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_recipe_comments_recipe_created").on(t.recipeId, t.createdAt.desc()),
    index("idx_recipe_comments_user").on(t.userId),
  ]
);

/**
 * A viewer's report of an abusive comment (cefiro social layer). One row per
 * (comment, reporter) so a person can't inflate a count by re-reporting. The
 * recipe owner and server admins can already delete any comment; these rows
 * capture community flags for review.
 */
export const commentReports = pgTable(
  "comment_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => recipeComments.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_comment_reports_comment_reporter").on(t.commentId, t.reporterId),
    index("idx_comment_reports_comment").on(t.commentId),
  ]
);
