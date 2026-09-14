import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
