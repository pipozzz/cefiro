import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import type { Page } from "../schema";
import { pages } from "../schema";

export interface PageInput {
  slug: string;
  title: string;
  body: string;
  metaDescription?: string | null;
  status: "draft" | "published";
}

/** A published page for public rendering at /{slug}. Null when missing/draft. */
export async function getPublishedPageBySlug(slug: string): Promise<Page | null> {
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug.toLowerCase()), eq(pages.status, "published")))
    .limit(1);

  return row ?? null;
}

/** Any page by id (admin). */
export async function getPageById(id: string): Promise<Page | null> {
  const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);

  return row ?? null;
}

/** All pages, newest-updated first (admin list). */
export async function listPages(): Promise<Page[]> {
  return db.select().from(pages).orderBy(desc(pages.updatedAt));
}

/** Slugs (+ updatedAt) of published pages — for the sitemap and the proxy cache. */
export async function listPublishedPageSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: pages.slug, updatedAt: pages.updatedAt })
    .from(pages)
    .where(eq(pages.status, "published"));
}

/** True when another page already uses this slug (case-insensitive). */
export async function isPageSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const where = excludeId
    ? and(eq(pages.slug, slug.toLowerCase()), ne(pages.id, excludeId))
    : eq(pages.slug, slug.toLowerCase());
  const [row] = await db.select({ id: pages.id }).from(pages).where(where).limit(1);

  return !!row;
}

export async function createPage(input: PageInput, userId: string | null): Promise<Page> {
  const [row] = await db
    .insert(pages)
    .values({
      slug: input.slug.toLowerCase(),
      title: input.title,
      body: input.body,
      metaDescription: input.metaDescription ?? null,
      status: input.status,
      updatedBy: userId,
    })
    .returning();

  return row!;
}

export async function updatePage(id: string, input: PageInput, userId: string): Promise<Page> {
  const [row] = await db
    .update(pages)
    .set({
      slug: input.slug.toLowerCase(),
      title: input.title,
      body: input.body,
      metaDescription: input.metaDescription ?? null,
      status: input.status,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, id))
    .returning();

  return row!;
}

export async function deletePage(id: string): Promise<void> {
  await db.delete(pages).where(eq(pages.id, id));
}
