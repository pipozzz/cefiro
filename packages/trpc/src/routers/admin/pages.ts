import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createPage,
  deletePage,
  getPageById,
  isPageSlugTaken,
  listPages,
  updatePage,
} from "@norish/db/repositories/pages";
import { invalidatePublishedPageSlugs } from "@norish/shared-server/cache/pages";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { isReservedRootSlug, PAGE_SLUG_RE } from "@norish/shared/lib/reserved-page-slugs";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

const PageInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(80)
    .regex(PAGE_SLUG_RE, "Use lowercase letters, numbers and hyphens"),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50000),
  metaDescription: z.string().trim().max(300).nullable().optional(),
  status: z.enum(["draft", "published"]),
});

/** Reject slugs that collide with a real route (login, settings, …). */
function assertUsableSlug(slug: string): void {
  if (isReservedRootSlug(slug)) {
    throw new TRPCError({ code: "CONFLICT", message: `"/${slug}" is a reserved path` });
  }
}

const listPagesProcedure = adminProcedure.query(async () => {
  return listPages();
});

const getPage = adminProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
  return getPageById(input.id);
});

const createPageProcedure = adminProcedure
  .input(PageInputSchema)
  .mutation(async ({ input, ctx }) => {
    assertUsableSlug(input.slug);

    if (await isPageSlugTaken(input.slug)) {
      throw new TRPCError({ code: "CONFLICT", message: "That slug is already used" });
    }

    const page = await createPage(input, ctx.user.id);

    await invalidatePublishedPageSlugs();
    log.info({ userId: ctx.user.id, slug: page.slug }, "Created page");

    return { page };
  });

const updatePageProcedure = adminProcedure
  .input(PageInputSchema.extend({ id: z.uuid() }))
  .mutation(async ({ input, ctx }) => {
    assertUsableSlug(input.slug);

    if (await isPageSlugTaken(input.slug, input.id)) {
      throw new TRPCError({ code: "CONFLICT", message: "That slug is already used" });
    }

    const { id, ...values } = input;
    const page = await updatePage(id, values, ctx.user.id);

    await invalidatePublishedPageSlugs();
    log.info({ userId: ctx.user.id, slug: page.slug }, "Updated page");

    return { page };
  });

const deletePageProcedure = adminProcedure
  .input(z.object({ id: z.uuid() }))
  .mutation(async ({ input, ctx }) => {
    await deletePage(input.id);
    await invalidatePublishedPageSlugs();
    log.info({ userId: ctx.user.id, id: input.id }, "Deleted page");

    return { success: true };
  });

export const pagesProcedures = router({
  list: listPagesProcedure,
  get: getPage,
  create: createPageProcedure,
  update: updatePageProcedure,
  delete: deletePageProcedure,
});
