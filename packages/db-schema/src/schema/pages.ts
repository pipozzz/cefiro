import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { mutableRowColumns } from "./shared";

/**
 * Admin-managed static pages (the "custom pages" CMS, Ghost-like): privacy,
 * pricing, terms, about, etc. Each is served at a root URL `/{slug}` when
 * published. Body is stored as Markdown (rendered safely on the public page);
 * `status` gates public visibility. Authored by server admins only.
 */
export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Root URL segment (already lowercased, [a-z0-9-]); globally unique.
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // Markdown body.
    body: text("body").notNull().default(""),
    // Optional meta description for SEO / share cards.
    metaDescription: text("meta_description"),
    // "draft" (admin-only) or "published" (public at /{slug}).
    status: text("status").notNull().default("draft"),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...mutableRowColumns,
  },
  (t) => [uniqueIndex("uq_pages_slug").on(t.slug), index("idx_pages_status").on(t.status)]
);

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
