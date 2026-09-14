import { boolean, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { mutableRowColumns } from "./shared";

/**
 * Public-facing identity for the social layer (cefiro).
 *
 * The `user` table stores email/name/image ENCRYPTED at rest, so it must
 * never back a public profile. This table holds only fields the user has
 * chosen to expose publicly: a unique `handle` for `/@handle` URLs, a plain
 * `displayName`, `bio`, and a public `avatarUrl` (distinct from the encrypted
 * `user.image`). One row per user (userId is the PK).
 *
 * `handle` is stored already-lowercased; enforce that in the write path.
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    location: text("location"),
    websiteUrl: text("website_url"),
    // Whether the profile (and its public recipes) is discoverable/listed.
    isPublic: boolean("is_public").notNull().default(true),
    ...mutableRowColumns,
  },
  (t) => [
    uniqueIndex("uq_user_profiles_handle").on(t.handle),
    index("idx_user_profiles_is_public").on(t.isPublic),
  ]
);
