import { TRPCError } from "@trpc/server";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { PublicRecipeViewDTO } from "@norish/shared/contracts/dto/recipe-shares";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import {
  getProfileByHandle,
  getProfileByUserId,
  getRecipePublishState,
  getViewableRecipeRefBySlug,
  isHandleAvailable,
  listPublicRecipesByUserId,
  setRecipeVisibility,
  upsertProfile,
  type PublicProfile,
} from "@norish/db/repositories/user-profiles";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { PublicRecipeViewSchema } from "@norish/shared/contracts/zod/recipe-shares";
import {
  CheckHandleInputSchema,
  GetProfileByHandleInputSchema,
  GetPublicRecipeBySlugInputSchema,
  ListPublicRecipesByHandleInputSchema,
  SetRecipeVisibilityInputSchema,
  UpsertProfileInputSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { publicProcedure, router } from "../../trpc";

/**
 * Rewrite an owner-scoped `/recipes/{id}/...` media URL to the public
 * slug-scoped route so anonymous viewers can load images without auth.
 * Mirrors `toSharedMediaUrl` (share links) for the slug-based flow.
 */
function toSlugMediaUrl(url: string | null | undefined, slug: string): string | null {
  if (!url) {
    return null;
  }

  if (!url.startsWith("/recipes/")) {
    return url;
  }

  const [pathname] = url.split("?", 1);
  const stepMatch = pathname?.match(/^\/recipes\/[^/]+\/steps\/([^/]+)$/);

  if (stepMatch?.[1]) {
    return `/r/${slug}/steps/${stepMatch[1]}`;
  }

  const mediaMatch = pathname?.match(/^\/recipes\/[^/]+\/([^/]+)$/);

  if (mediaMatch?.[1]) {
    return `/r/${slug}/media/${mediaMatch[1]}`;
  }

  return url;
}

function mapRecipeToPublicSlugView(recipe: FullRecipeDTO, slug: string): PublicRecipeViewDTO {
  return PublicRecipeViewSchema.parse({
    name: recipe.name,
    description: recipe.description ?? null,
    notes: recipe.notes ?? null,
    url: recipe.url ?? null,
    image: toSlugMediaUrl(recipe.image, slug),
    dishColor: recipe.dishColor ?? null,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes ?? null,
    cookMinutes: recipe.cookMinutes ?? null,
    totalMinutes: recipe.totalMinutes ?? null,
    systemUsed: recipe.systemUsed,
    calories: recipe.calories ?? null,
    fat: recipe.fat ?? null,
    carbs: recipe.carbs ?? null,
    protein: recipe.protein ?? null,
    categories: recipe.categories ?? [],
    tags: (recipe.tags ?? []).map((tag) => ({ name: tag.name })),
    recipeIngredients: (recipe.recipeIngredients ?? []).map((ingredient) => ({
      ingredientName: ingredient.ingredientName,
      amount: ingredient.amount,
      unit: ingredient.unit ?? null,
      systemUsed: ingredient.systemUsed,
      order: ingredient.order,
    })),
    steps: (recipe.steps ?? []).map((step) => ({
      step: step.step,
      systemUsed: step.systemUsed,
      order: step.order,
      images: (step.images ?? []).map((image) => ({
        image: toSlugMediaUrl(image.image, slug),
        order: image.order,
      })),
      stepIngredients: step.stepIngredients ?? [],
    })),
    // Public authorship comes from the cefiro profile, never the encrypted user
    // record, so it is attached separately by the caller — not here.
    author: null,
    images: (recipe.images ?? []).map((image) => ({
      image: toSlugMediaUrl(image.image, slug),
      order: image.order,
    })),
    videos: (recipe.videos ?? []).map((video) => ({
      video: toSlugMediaUrl(video.video, slug),
      thumbnail: toSlugMediaUrl(video.thumbnail ?? null, slug),
      duration: video.duration ?? null,
      order: video.order,
    })),
  });
}

function toPublicProfileDto(profile: PublicProfile) {
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    location: profile.location,
    websiteUrl: profile.websiteUrl,
    memberSince: profile.createdAt,
  };
}

// --- Profile management (authenticated) ---------------------------------

const getMyProfile = authedProcedure.query(async ({ ctx }) => {
  const profile = await getProfileByUserId(ctx.user.id);

  return { profile };
});

const checkHandle = authedProcedure
  .input(CheckHandleInputSchema)
  .query(async ({ ctx, input }) => {
    const available = await isHandleAvailable(input.handle, ctx.user.id);

    return { handle: input.handle, available };
  });

const upsertMyProfile = authedProcedure
  .input(UpsertProfileInputSchema)
  .mutation(async ({ ctx, input }) => {
    const available = await isHandleAvailable(input.handle, ctx.user.id);

    if (!available) {
      throw new TRPCError({ code: "CONFLICT", message: "That handle is already taken" });
    }

    const profile = await upsertProfile(ctx.user.id, input);

    log.info({ userId: ctx.user.id, handle: profile.handle }, "Upserted public profile");

    return { profile };
  });

// --- Recipe publishing (authenticated, owner only) ----------------------

const getPublishState = authedProcedure
  .input(SetRecipeVisibilityInputSchema.pick({ recipeId: true }))
  .query(async ({ ctx, input }) => {
    const state = await getRecipePublishState(ctx.user.id, input.recipeId);

    if (!state) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    return state;
  });

const setVisibility = authedProcedure
  .input(SetRecipeVisibilityInputSchema)
  .mutation(async ({ ctx, input }) => {
    const result = await setRecipeVisibility(ctx.user.id, input.recipeId, input.visibility);

    if (!result) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Recipe not found or you do not have permission to publish it",
      });
    }

    log.info(
      { userId: ctx.user.id, recipeId: input.recipeId, visibility: input.visibility },
      "Set recipe visibility"
    );

    return result;
  });

// --- Public reads (unauthenticated) -------------------------------------

const getProfile = publicProcedure
  .input(GetProfileByHandleInputSchema)
  .query(async ({ input }) => {
    const profile = await getProfileByHandle(input.handle);

    if (!profile || !profile.isPublic) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    }

    return { profile: toPublicProfileDto(profile) };
  });

const listProfileRecipes = publicProcedure
  .input(ListPublicRecipesByHandleInputSchema)
  .query(async ({ input }) => {
    const profile = await getProfileByHandle(input.handle);

    if (!profile || !profile.isPublic) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    }

    const { items, nextCursor } = await listPublicRecipesByUserId(
      profile.userId,
      input.limit,
      input.cursor
    );

    // Rewrite the card thumbnail to the public slug route.
    const recipes = items.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      image: item.slug ? toSlugMediaUrl(item.image, item.slug) : null,
      dishColor: item.dishColor,
      totalMinutes: item.totalMinutes,
      publishedAt: item.publishedAt,
    }));

    return { recipes, nextCursor };
  });

const getPublicRecipe = publicProcedure
  .input(GetPublicRecipeBySlugInputSchema)
  .query(async ({ input }) => {
    const ref = await getViewableRecipeRefBySlug(input.slug);

    if (!ref) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    const full = await getRecipeFull(ref.recipeId);

    if (!full) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    const recipe = mapRecipeToPublicSlugView(full, input.slug);

    // Attach the public author profile (if the owner has one and it is public).
    let author: ReturnType<typeof toPublicProfileDto> | null = null;

    if (ref.userId) {
      const profile = await getProfileByUserId(ref.userId);

      if (profile?.isPublic) {
        author = toPublicProfileDto(profile);
      }
    }

    return { slug: input.slug, visibility: ref.visibility, recipe, author };
  });

export const socialProcedures = router({
  getMyProfile,
  checkHandle,
  upsertMyProfile,
  getPublishState,
  setVisibility,
  getProfile,
  listProfileRecipes,
  getPublicRecipe,
});
