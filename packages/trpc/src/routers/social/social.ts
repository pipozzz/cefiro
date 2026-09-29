import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { FeedRecipeRow } from "@norish/db/repositories/follows";
import type {
  DiscoverCookbookCard,
  PublicCookbookCard,
} from "@norish/db/repositories/public-cookbooks";
import type { RatingStats } from "@norish/db/repositories/ratings";
import type { PublicProfile, PublicProfileCard } from "@norish/db/repositories/user-profiles";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { PublicRecipeViewDTO } from "@norish/shared/contracts/dto/recipe-shares";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  addFavorite,
  countRecipeFavorites,
  isFavorite,
  removeFavorite,
} from "@norish/db/repositories/favorites";
import {
  countPublicRecipesByCategory,
  countPublicRecipesByCuisine,
  followUser,
  getFollowCounts,
  getPublicRecipesByIds,
  getRandomPublicRecipes,
  getRecipeIngredientNamesByRecipeIds,
  getRecipeOfTheDay,
  isFollowing,
  listDiscoverRecipes,
  listDiscoverThemes,
  listFeedRecipes,
  listForYouByTaste,
  listForYouRecipes,
  listRelatedPublicRecipes,
  listTrendingTopics,
  searchPublicRecipes,
  searchPublicRecipesByIngredients,
  unfollowUser,
} from "@norish/db/repositories/follows";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
} from "@norish/db/repositories/notifications";
import {
  getCookbookPublishState,
  getPublicCookbookBySlug,
  listDiscoverCookbooks,
  listPublicCookbooksByUserId,
  setCookbookDescription,
  setCookbookVisibility,
} from "@norish/db/repositories/public-cookbooks";
import {
  getAverageRating,
  getAverageRatingsByRecipeIds,
  getUserRating,
  rateRecipe,
} from "@norish/db/repositories/ratings";
import {
  addComment,
  countCommentsForRecipe,
  deleteComment,
  getCommentOwnership,
  listCommentsForRecipe,
  reportComment,
} from "@norish/db/repositories/recipe-comments";
import {
  findSimilarPublicRecipes,
  getUserTasteVector,
} from "@norish/db/repositories/recipe-embeddings";
import {
  createSavedForkGuarded,
  getImportedRecipeIds,
  getPublicSavedFromAttribution,
  getRecipeFull,
  getRecipeSourceRoot,
  getSavedForkForUser,
  getSavedFromAttribution,
  listImportedVisibleRecipeIds,
  listOwnRecipesForSharing,
} from "@norish/db/repositories/recipes";
import { getThemeById, listThemes, listThemesForUser } from "@norish/db/repositories/themes";
import { getUserAllergies } from "@norish/db/repositories/user-allergies";
import {
  getProfileByHandle,
  getProfileByUserId,
  getRecipePublishState,
  getViewableRecipeRefById,
  getViewableRecipeRefBySlug,
  isHandleAvailable,
  listDiscoverProfiles,
  listPublicRecipesByUserId,
  listSuggestedProfiles,
  searchPublicProfiles,
  setRecipeVisibility,
  upsertProfile,
} from "@norish/db/repositories/user-profiles";
import { scheduleRecipeEmbedding } from "@norish/queue";
import { embedText, isEmbeddingConfigured } from "@norish/shared-server/ai/embeddings/voyage";
import {
  getTimerKeywords,
  getUnits,
  isTimersEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { copyRecipeImageByUrl, saveProfileAvatarBytes } from "@norish/shared-server/media/storage";
import { sendSocialNotification } from "@norish/shared-server/push/social-notify";
import { ALLOWED_IMAGE_MIME_SET } from "@norish/shared/contracts";
import {
  AddCommentInputSchema,
  CheckHandleInputSchema,
  CookbookPublishStateInputSchema,
  DeleteCommentInputSchema,
  DiscoverCookbooksInputSchema,
  DiscoverCooksInputSchema,
  DiscoverInputSchema,
  FeedInputSchema,
  FollowByHandleInputSchema,
  GetProfileByHandleInputSchema,
  GetPublicCookbookBySlugInputSchema,
  GetPublicRecipeBySlugInputSchema,
  LikeStatusInputSchema,
  ListCommentsInputSchema,
  ListNotificationsInputSchema,
  ListPublicCookbooksByHandleInputSchema,
  ListPublicRecipesByHandleInputSchema,
  MyRatingInputSchema,
  RateRecipeInputSchema,
  RelatedRecipesInputSchema,
  ReportCommentInputSchema,
  SaveRecipeInputSchema,
  SearchByIngredientsInputSchema,
  SearchInputSchema,
  SetCookbookDescriptionInputSchema,
  SetCookbookVisibilityInputSchema,
  SetRecipeVisibilityBulkInputSchema,
  SetRecipeVisibilityInputSchema,
  SuggestedCooksInputSchema,
  SurpriseRecipesInputSchema,
  ToggleLikeInputSchema,
  TrendingTopicsInputSchema,
  UpsertProfileInputSchema,
} from "@norish/shared/contracts/zod";
import { PublicRecipeViewSchema } from "@norish/shared/contracts/zod/recipe-shares";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";

import { formDataInputSchema, getUploadedFile } from "../../form-data";
import { authedProcedure } from "../../middleware";
import { rateLimit } from "../../rate-limit-middleware";
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
  // The hero mirrors the "primary image" rule the rest of the app uses: the
  // first gallery image, with the legacy scalar only as a fallback. An imported
  // recipe whose photo landed only in the gallery still gets a hero.
  const heroImage = recipe.image ?? recipe.images?.[0]?.image ?? null;

  return PublicRecipeViewSchema.parse({
    name: recipe.name,
    description: recipe.description ?? null,
    notes: recipe.notes ?? null,
    url: recipe.url ?? null,
    image: toSlugMediaUrl(heroImage, slug),
    dishColor: recipe.dishColor ?? null,
    // An imported recipe can have no stated yield (0 or null); treat that as
    // "unknown" so it hides the servings pill instead of failing validation.
    servings: recipe.servings && recipe.servings > 0 ? recipe.servings : null,
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

function toFeedCard(row: FeedRecipeRow) {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.slug ? toSlugMediaUrl(row.image, row.slug) : null,
    dishColor: row.dishColor,
    totalMinutes: row.totalMinutes,
    servings: row.servings,
    originCountry: row.originCountry,
    tags: row.tags,
    publishedAt: row.publishedAt,
    favoriteCount: row.favoriteCount,
    author: row.authorHandle
      ? {
          handle: row.authorHandle,
          displayName: row.authorDisplayName,
          avatarUrl: row.authorAvatarUrl,
        }
      : null,
  };
}

function toProfileCard(row: PublicProfileCard) {
  return {
    handle: row.handle,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    recipeCount: row.recipeCount,
  };
}

function toCookbookCard(row: PublicCookbookCard) {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    recipeCount: row.recipeCount,
    coverImages: row.coverImages
      .map((c) => (c.recipeSlug ? toSlugMediaUrl(c.image, c.recipeSlug) : null))
      .filter((u): u is string => !!u),
  };
}

function toDiscoverCookbookCard(row: DiscoverCookbookCard) {
  return { ...toCookbookCard(row), owner: row.owner };
}

function toRatingDto(stats: RatingStats | undefined): { average: number | null; count: number } {
  return { average: stats?.averageRating ?? null, count: stats?.ratingCount ?? 0 };
}

/** Map feed/discover rows to cards, attaching each recipe's average rating. */
async function toFeedCardsWithRatings(rows: FeedRecipeRow[]) {
  const ratings = await getAverageRatingsByRecipeIds(rows.map((r) => r.id));

  return rows.map((row) => ({ ...toFeedCard(row), rating: toRatingDto(ratings.get(row.id)) }));
}

// --- Profile management (authenticated) ---------------------------------

const getMyProfile = authedProcedure.query(async ({ ctx }) => {
  const profile = await getProfileByUserId(ctx.user.id);

  return { profile };
});

const checkHandle = authedProcedure.input(CheckHandleInputSchema).query(async ({ ctx, input }) => {
  const available = await isHandleAvailable(input.handle, ctx.user.id);

  return { handle: input.handle, available };
});

const upsertMyProfile = authedProcedure
  .use(rateLimit({ name: "social.upsertMyProfile", limit: 10, windowSec: 60 }))
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

    // Reconcile the discovery embedding: the worker embeds it if it is now
    // public, or drops it if it went private. Fire-and-forget.
    scheduleRecipeEmbedding(input.recipeId);

    return result;
  });

/** The caller's recipes for the bulk sharing manager. */
const myRecipesForSharing = authedProcedure.query(async ({ ctx }) =>
  listOwnRecipesForSharing(ctx.user.id)
);

/**
 * Set visibility on many of the caller's recipes at once — the bulk sharing
 * manager's action, so an owner can make a whole library public in one go.
 * Reuses the single-recipe path per id (ownership check + slug generation +
 * publishedAt), and silently skips ids that are not the caller's.
 *
 * Copyright guardrail: when making recipes PUBLIC, imported recipes (those with
 * an external source) are skipped — a bulk sweep offers no per-recipe judgement,
 * so external content is never broadcast to discovery/search this way. They are
 * reported back as `skippedImported`. An owner who genuinely holds the rights can
 * still publish an imported recipe one at a time through the single-recipe flow,
 * which shows the copyright warning. Link-only and private are unaffected.
 */
const setVisibilityBulk = authedProcedure
  .use(rateLimit({ name: "social.setVisibilityBulk", limit: 20, windowSec: 60 }))
  .input(SetRecipeVisibilityBulkInputSchema)
  .mutation(async ({ ctx, input }): Promise<{ updated: number; skippedImported: number }> => {
    let ids = input.recipeIds;
    let skippedImported = 0;

    if (input.visibility === "public") {
      const imported = await getImportedRecipeIds(ctx.user.id, ids);

      if (imported.size > 0) {
        skippedImported = imported.size;
        ids = ids.filter((id) => !imported.has(id));
      }
    }

    let updated = 0;

    for (const recipeId of ids) {
      const result = await setRecipeVisibility(ctx.user.id, recipeId, input.visibility);

      if (result) {
        updated += 1;
        scheduleRecipeEmbedding(recipeId);
      }
    }

    log.info(
      {
        userId: ctx.user.id,
        count: input.recipeIds.length,
        updated,
        skippedImported,
        visibility: input.visibility,
      },
      "Bulk set recipe visibility"
    );

    return { updated, skippedImported };
  });

/**
 * Unpublish all of the caller's imported recipes — set every imported recipe
 * that is currently public or unlisted back to private, and drop it from
 * discovery. The cleanup counterpart to the bulk-publish guardrail: external
 * content that was shared before the guardrail existed can be pulled back in one
 * action. Only the caller's own recipes are touched; authored (non-imported)
 * recipes are never affected.
 */
const unpublishImported = authedProcedure
  .use(rateLimit({ name: "social.unpublishImported", limit: 10, windowSec: 60 }))
  .mutation(async ({ ctx }): Promise<{ updated: number }> => {
    const ids = await listImportedVisibleRecipeIds(ctx.user.id);

    let updated = 0;

    for (const recipeId of ids) {
      const result = await setRecipeVisibility(ctx.user.id, recipeId, "private");

      if (result) {
        updated += 1;
        scheduleRecipeEmbedding(recipeId);
      }
    }

    log.info({ userId: ctx.user.id, updated }, "Unpublished imported recipes");

    return { updated };
  });

// --- Public reads (unauthenticated) -------------------------------------

const getProfile = publicProcedure.input(GetProfileByHandleInputSchema).query(async ({ input }) => {
  const profile = await getProfileByHandle(input.handle);

  if (!profile || !profile.isPublic) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  }

  const counts = await getFollowCounts(profile.userId);

  return { profile: toPublicProfileDto(profile), counts };
});

/**
 * The discovery themes a public profile's recipes fall into, each with a
 * name-slug link to its theme page. Empty (not an error) for a private/missing
 * profile, or when the cook has no embedded recipes / no themes exist yet.
 */
const profileThemes = publicProcedure
  .input(GetProfileByHandleInputSchema)
  .query(async ({ input }) => {
    type ProfileTheme = { name: string; slug: string; recipeCount: number; image: string | null };

    const profile = await getProfileByHandle(input.handle);

    if (!profile || !profile.isPublic) {
      return { themes: [] as ProfileTheme[] };
    }

    const [rows, catalog] = await Promise.all([
      listThemesForUser(profile.userId),
      // The theme catalog carries the tile image; index it by slug so the
      // profile chips can show the same image as the discover theme tiles.
      listThemes(200),
    ]);

    const imageBySlug = new Map<string, string | null>();

    for (const theme of catalog) {
      const slug = cuisineSlug(theme.name);

      if (!slug || imageBySlug.has(slug)) {
        continue;
      }

      imageBySlug.set(
        slug,
        (theme.image && theme.slug ? toSlugMediaUrl(theme.image, theme.slug) : null) ??
          theme.generatedImage ??
          null
      );
    }

    const seen = new Set<string>();
    const themesOut: ProfileTheme[] = [];

    // Themes can share a name; merge by slug (the page key) keeping the largest.
    for (const row of rows) {
      const slug = cuisineSlug(row.name);

      if (!slug || seen.has(slug)) {
        continue;
      }

      seen.add(slug);
      themesOut.push({
        name: row.name,
        slug,
        recipeCount: row.recipeCount,
        image: imageBySlug.get(slug) ?? null,
      });
    }

    return { themes: themesOut };
  });

// --- Follow graph (authenticated) ---------------------------------------

async function resolveFolloweeId(handle: string): Promise<{ userId: string }> {
  const profile = await getProfileByHandle(handle);

  if (!profile) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  }

  return { userId: profile.userId };
}

const follow = authedProcedure
  .use(rateLimit({ name: "social.follow", limit: 30, windowSec: 60 }))
  .input(FollowByHandleInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = await resolveFolloweeId(input.handle);

    if (userId === ctx.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot follow yourself" });
    }

    await followUser(ctx.user.id, userId);
    await sendSocialNotification({ userId, actorId: ctx.user.id, type: "follow" });

    return { handle: input.handle, isFollowing: true };
  });

const unfollow = authedProcedure
  .use(rateLimit({ name: "social.unfollow", limit: 30, windowSec: 60 }))
  .input(FollowByHandleInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = await resolveFolloweeId(input.handle);

    await unfollowUser(ctx.user.id, userId);

    return { handle: input.handle, isFollowing: false };
  });

/** The current viewer's follow relationship to a handle (self => null). */
// Public so a signed-out visitor viewing a profile doesn't trigger an
// UNAUTHORIZED console error; anonymous callers get isFollowing/isSelf false.
const getFollowStatus = publicProcedure
  .input(FollowByHandleInputSchema)
  .query(async ({ ctx, input }) => {
    const profile = await getProfileByHandle(input.handle);

    if (!profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    }

    const isSelf = ctx.user ? profile.userId === ctx.user.id : false;
    const following = ctx.user && !isSelf ? await isFollowing(ctx.user.id, profile.userId) : false;

    return { handle: input.handle, isSelf, isFollowing: following, isAuthenticated: !!ctx.user };
  });

// --- Feed & discovery ---------------------------------------------------

const feed = authedProcedure.input(FeedInputSchema).query(async ({ ctx, input }) => {
  const { items, nextCursor } = await listFeedRecipes(ctx.user.id, input.limit, input.cursor);

  return { recipes: await toFeedCardsWithRatings(items), nextCursor };
});

// The personalised default for signed-in readers: a blended feed of recipes
// from the cooks they follow plus the best of the wider community, always
// filtered by their own dietary profile (allergens resolved server-side from the
// session, never sent by the client).
//
// When the reader has favourited recipes that carry embeddings, the feed is
// ranked by nearness to their taste vector (the mean of those embeddings), so it
// leans towards what they already love; otherwise it falls back to the blended
// follow/popularity/recency ordering. The taste vector is derived once here and
// held across the reader's pagination, so pages stay consistent.
const forYou = authedProcedure.input(FeedInputSchema).query(async ({ ctx, input }) => {
  const { allergies } = await getUserAllergies(ctx.user.id);
  const tasteVector = await getUserTasteVector(ctx.user.id);

  const { items, nextCursor } = tasteVector
    ? await listForYouByTaste({
        userId: ctx.user.id,
        tasteVector,
        excludeAllergenTags: allergies,
        limit: input.limit,
        cursor: input.cursor,
      })
    : await listForYouRecipes({
        userId: ctx.user.id,
        excludeAllergenTags: allergies,
        limit: input.limit,
        cursor: input.cursor,
      });

  return { recipes: await toFeedCardsWithRatings(items), nextCursor };
});

const discover = publicProcedure.input(DiscoverInputSchema).query(async ({ ctx, input }) => {
  // Dietary-aware discovery: resolve the reader's allergen tags server-side from
  // the session, so the sensitive list never travels in the (GET) query string.
  // Anonymous readers have no session, so the filter is simply a no-op for them.
  let excludeAllergenTags: string[] | undefined;

  if (input.hideMyAllergens && ctx.user) {
    const { allergies } = await getUserAllergies(ctx.user.id);

    excludeAllergenTags = allergies;
  }

  const { items, nextCursor } = await listDiscoverRecipes({
    sort: input.sort,
    category: input.category,
    tag: input.tag,
    cuisine: input.cuisine,
    maxMinutes: input.maxMinutes,
    excludeAllergenTags,
    limit: input.limit,
    cursor: input.cursor,
  });

  return { recipes: await toFeedCardsWithRatings(items), nextCursor };
});

/**
 * Category facet counts for /discover: how many public recipes are in each meal
 * category under the reader's current tag / "ready in" / dietary filters, so the
 * category chips can show counts. Dietary is resolved server-side from the
 * session (never sent in the query string), like `discover`.
 */
const discoverCategoryCounts = publicProcedure
  .input(
    z.object({
      tag: z.string().trim().min(1).max(50).optional(),
      maxMinutes: z.number().int().min(1).max(1440).optional(),
      hideMyAllergens: z.boolean().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    let excludeAllergenTags: string[] | undefined;

    if (input.hideMyAllergens && ctx.user) {
      const { allergies } = await getUserAllergies(ctx.user.id);

      excludeAllergenTags = allergies;
    }

    return countPublicRecipesByCategory({
      tag: input.tag,
      maxMinutes: input.maxMinutes,
      excludeAllergenTags,
    });
  });

/**
 * Cuisine facet counts for /discover: how many public recipes carry each cuisine
 * under the reader's current tag / "ready in" / dietary filters, so the cuisine
 * chips can show counts. Same server-side allergen resolution as `discover`.
 */
const discoverCuisineCounts = publicProcedure
  .input(
    z.object({
      tag: z.string().trim().min(1).max(50).optional(),
      maxMinutes: z.number().int().min(1).max(1440).optional(),
      hideMyAllergens: z.boolean().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    let excludeAllergenTags: string[] | undefined;

    if (input.hideMyAllergens && ctx.user) {
      const { allergies } = await getUserAllergies(ctx.user.id);

      excludeAllergenTags = allergies;
    }

    return countPublicRecipesByCuisine({
      tag: input.tag,
      maxMinutes: input.maxMinutes,
      excludeAllergenTags,
    });
  });

// --- Search -------------------------------------------------------------

const search = publicProcedure.input(SearchInputSchema).query(async ({ input }) => {
  const [recipeRows, profileRows] = await Promise.all([
    searchPublicRecipes(input.q, input.limit),
    searchPublicProfiles(input.q, input.limit),
  ]);

  let recipes = recipeRows;

  // Hybrid search: full-text is exact and free, but it misses synonyms and
  // natural-language queries ("something quick with chicken"). When it comes back
  // short, embed the query and top the results up with the nearest public recipes
  // by meaning. Bounded to a sparse result set, so the common case never pays the
  // embedding round-trip, and wrapped so a Voyage hiccup degrades to the
  // full-text results rather than failing the search.
  if (isEmbeddingConfigured() && recipeRows.length < input.limit) {
    try {
      const seen = new Set(recipeRows.map((row) => row.id));
      const vector = await embedText(input.q, "query");
      const neighbors = await findSimilarPublicRecipes(vector, input.limit);
      const extraIds = neighbors.map((neighbor) => neighbor.recipeId).filter((id) => !seen.has(id));

      if (extraIds.length > 0) {
        const extras = await getPublicRecipesByIds(extraIds);
        // getPublicRecipesByIds returns storage order; restore similarity order.
        const byId = new Map(extras.map((row) => [row.id, row]));
        const ordered = extraIds
          .map((id) => byId.get(id))
          .filter((row): row is (typeof extras)[number] => row !== undefined);

        recipes = [...recipeRows, ...ordered].slice(0, input.limit);
      }
    } catch (error) {
      log.warn({ error }, "Semantic search fallback failed; using full-text results");
    }
  }

  return {
    recipes: await toFeedCardsWithRatings(recipes),
    profiles: profileRows.map(toProfileCard),
  };
});

// "Cook with what you have": public recipes ranked by how many of the given
// ingredients they use.
const searchByIngredients = publicProcedure
  .input(SearchByIngredientsInputSchema)
  .query(async ({ input }) => {
    const rows = await searchPublicRecipesByIngredients(input.ingredients, input.limit);
    const cards = await toFeedCardsWithRatings(rows);
    const namesByRecipe = await getRecipeIngredientNamesByRecipeIds(rows.map((row) => row.id));

    const terms = input.ingredients.map((term) => term.trim().toLowerCase()).filter(Boolean);

    // For each recipe, split its ingredients into what the reader already has
    // (an ingredient whose name overlaps one of the entered terms) and what is
    // still missing — so the UI can offer to add the gap to the shopping list.
    const recipes = rows.map((row, index) => {
      const names = namesByRecipe.get(row.id) ?? [];
      const missing = names.filter((name) => {
        const lower = name.toLowerCase();

        return !terms.some((term) => lower.includes(term) || term.includes(lower));
      });

      return {
        ...cards[index],
        recipeId: row.id,
        have: names.length - missing.length,
        total: names.length,
        missing,
      };
    });

    return { recipes };
  });

// Trending discovery topics: the most-used tags across public recipes, for the
// clickable topic chips on /discover.
const trendingTopics = publicProcedure.input(TrendingTopicsInputSchema).query(async ({ input }) => {
  return { topics: await listTrendingTopics(input.limit) };
});

// Discover themes for the discovery landing's theme tiles.
//
// Semantic clusters (Phase B) when the clustering job has built any: each tile
// carries a `themeId` and clicking it runs a vector-similarity search
// (`themeRecipes`) — surfacing recipes near the cluster even when they share no
// tags. Until then it falls back to the tag-based strip (Phase A): those tiles
// carry `tag` instead, and clicking drives the existing tag filter. The sample
// image is rewritten to the public slug-scoped media URL for anonymous visitors.
const discoverThemes = publicProcedure
  .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }))
  .query(async ({ input }) => {
    const semantic = await listThemes(input.limit);

    if (semantic.length > 0) {
      return {
        themes: semantic.map((theme) => ({
          themeId: theme.id,
          tag: null as string | null,
          name: theme.name,
          recipeCount: theme.recipeCount,
          // Prefer the representative recipe's real photo (distinct, appetising),
          // and fall back to a generated tile image only when the cluster has no
          // photo at all.
          image:
            (theme.image && theme.slug ? toSlugMediaUrl(theme.image, theme.slug) : null) ??
            theme.generatedImage ??
            null,
        })),
      };
    }

    const rows = await listDiscoverThemes(input.limit);

    return {
      themes: rows.map((row) => ({
        themeId: null as string | null,
        tag: row.name,
        name: row.name,
        recipeCount: row.recipeCount,
        image: row.slug ? toSlugMediaUrl(row.image, row.slug) : null,
      })),
    };
  });

// The recipes of one semantic theme: public recipes nearest the cluster's
// centroid, most similar first. This is the vector-search payoff — a theme
// finds recipes by meaning, not by a shared tag. Empty (not an error) when the
// theme is gone or embeddings are unavailable, so the tile degrades quietly.
const themeRecipes = publicProcedure
  .input(z.object({ themeId: z.uuid(), limit: z.number().int().min(1).max(48).default(24) }))
  .query(async ({ input }) => {
    const theme = await getThemeById(input.themeId);

    if (!theme) {
      return { name: null as string | null, recipes: [] };
    }

    const similar = await findSimilarPublicRecipes(theme.centroid, input.limit);
    const rows = await getPublicRecipesByIds(similar.map((row) => row.recipeId));

    // `getPublicRecipesByIds` returns storage order; restore similarity order.
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = similar
      .map((row) => byId.get(row.recipeId))
      .filter((row): row is (typeof rows)[number] => Boolean(row));

    return { name: theme.name, recipes: await toFeedCardsWithRatings(ordered) };
  });

// Every semantic theme, for the dedicated themes browse page. Each carries a
// name-derived `slug` (the stable, shareable key: it survives a rebuild as long
// as the theme name does, and is the same slug the generated tile image uses).
// Deduped by slug — clusters occasionally share a name — keeping the highest
// ranked. Ordered by rank (largest clusters first); the client re-sorts/filters.
const themesList = publicProcedure
  .input(z.object({ limit: z.number().int().min(1).max(200).default(120) }))
  .query(async ({ input }) => {
    const themes = await listThemes(input.limit);
    const seen = new Set<string>();
    const out: { slug: string; name: string; recipeCount: number; image: string | null }[] = [];

    for (const theme of themes) {
      const slug = cuisineSlug(theme.name);

      if (!slug || seen.has(slug)) {
        continue;
      }

      seen.add(slug);
      out.push({
        slug,
        name: theme.name,
        recipeCount: theme.recipeCount,
        image:
          (theme.image && theme.slug ? toSlugMediaUrl(theme.image, theme.slug) : null) ??
          theme.generatedImage ??
          null,
      });
    }

    return { themes: out };
  });

// One theme's recipes resolved by its name slug (the stable URL key) rather than
// the churning id — powers the per-theme page at /discover/themes/[slug]. Same
// centroid vector search as `themeRecipes`; empty (not an error) when no current
// theme matches the slug, so a stale link degrades quietly.
const themeRecipesBySlug = publicProcedure
  .input(
    z.object({
      slug: z.string().trim().min(1).max(80),
      limit: z.number().int().min(1).max(48).default(24),
    })
  )
  .query(async ({ input }) => {
    const wanted = input.slug.toLowerCase();
    const themes = await listThemes(200);
    const theme = themes.find((row) => cuisineSlug(row.name) === wanted);

    if (!theme) {
      return { name: null as string | null, recipes: [] };
    }

    const similar = await findSimilarPublicRecipes(theme.centroid, input.limit);
    const rows = await getPublicRecipesByIds(similar.map((row) => row.recipeId));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = similar
      .map((row) => byId.get(row.recipeId))
      .filter((row): row is (typeof rows)[number] => Boolean(row));

    return { name: theme.name, recipes: await toFeedCardsWithRatings(ordered) };
  });

// "Recipe of the day": one public recipe, deterministic per calendar day.
const recipeOfTheDay = publicProcedure.query(async () => {
  const row = await getRecipeOfTheDay();
  const [recipe] = row ? await toFeedCardsWithRatings([row]) : [];

  return { recipe: recipe ?? null };
});

// "More like this": public recipes sharing the most tags with a given recipe.
const relatedRecipes = publicProcedure.input(RelatedRecipesInputSchema).query(async ({ input }) => {
  const rows = await listRelatedPublicRecipes(input.recipeId, input.limit);

  return { recipes: await toFeedCardsWithRatings(rows) };
});

// "Surprise me": a random handful of public recipes; refetch reshuffles.
const surpriseRecipes = publicProcedure
  .input(SurpriseRecipesInputSchema)
  .query(async ({ input }) => {
    return { recipes: await toFeedCardsWithRatings(await getRandomPublicRecipes(input.limit)) };
  });

const suggestedCooks = authedProcedure
  .input(SuggestedCooksInputSchema)
  .query(async ({ ctx, input }) => {
    const rows = await listSuggestedProfiles(ctx.user.id, input.limit);

    return { cooks: rows.map(toProfileCard) };
  });

const discoverCooks = publicProcedure.input(DiscoverCooksInputSchema).query(async ({ input }) => {
  const { items, nextCursor } = await listDiscoverProfiles(input.limit, input.cursor);

  return { cooks: items.map(toProfileCard), nextCursor };
});

const discoverCookbooks = publicProcedure
  .input(DiscoverCookbooksInputSchema)
  .query(async ({ input }) => {
    const { items, nextCursor } = await listDiscoverCookbooks(input.limit, input.cursor);

    return { cookbooks: items.map(toDiscoverCookbookCard), nextCursor };
  });

// --- Public cookbooks ---------------------------------------------------

const getPublicCookbook = publicProcedure
  .input(GetPublicCookbookBySlugInputSchema)
  .query(async ({ input }) => {
    const cb = await getPublicCookbookBySlug(input.slug);

    if (!cb) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Cookbook not found" });
    }

    return {
      slug: cb.slug,
      title: cb.title,
      description: cb.description,
      owner: cb.owner,
      recipes: await toFeedCardsWithRatings(cb.recipes),
    };
  });

const listPublicCookbooks = publicProcedure
  .input(ListPublicCookbooksByHandleInputSchema)
  .query(async ({ input }) => {
    const profile = await getProfileByHandle(input.handle);

    if (!profile || !profile.isPublic) {
      return { cookbooks: [] };
    }

    const rows = await listPublicCookbooksByUserId(profile.userId);

    return { cookbooks: rows.map(toCookbookCard) };
  });

const getCookbookPublishStateProc = authedProcedure
  .input(CookbookPublishStateInputSchema)
  .query(async ({ ctx, input }) => {
    const state = await getCookbookPublishState(ctx.user.id, input.cookbookId);

    if (!state) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Cookbook not found" });
    }

    return state;
  });

const setCookbookVisibilityProc = authedProcedure
  .use(rateLimit({ name: "social.setCookbookVisibility", limit: 20, windowSec: 60 }))
  .input(SetCookbookVisibilityInputSchema)
  .mutation(async ({ ctx, input }) => {
    const result = await setCookbookVisibility(ctx.user.id, input.cookbookId, input.visibility);

    if (!result) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cookbook not found or you do not own it",
      });
    }

    log.info(
      { userId: ctx.user.id, cookbookId: input.cookbookId, visibility: input.visibility },
      "Set cookbook visibility"
    );

    return result;
  });

const setCookbookDescriptionProc = authedProcedure
  .use(rateLimit({ name: "social.setCookbookDescription", limit: 20, windowSec: 60 }))
  .input(SetCookbookDescriptionInputSchema)
  .mutation(async ({ ctx, input }) => {
    const ok = await setCookbookDescription(ctx.user.id, input.cookbookId, input.description);

    if (!ok) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cookbook not found or you do not own it",
      });
    }

    return { ok: true };
  });

// --- Likes (favourites double as public likes) --------------------------

// Public so the like state can be read on the public recipe page without an
// UNAUTHORIZED error spamming the console for signed-out viewers; anonymous
// callers simply get `liked: false` and `isAuthenticated: false`.
const getLikeStatus = publicProcedure.input(LikeStatusInputSchema).query(async ({ ctx, input }) => {
  const liked = ctx.user ? await isFavorite(ctx.user.id, input.recipeId) : false;

  return { recipeId: input.recipeId, liked, isAuthenticated: !!ctx.user };
});

const toggleLike = authedProcedure
  .use(rateLimit({ name: "social.toggleLike", limit: 60, windowSec: 60 }))
  .input(ToggleLikeInputSchema)
  .mutation(async ({ ctx, input }) => {
    const ref = await getViewableRecipeRefById(input.recipeId);

    if (!ref) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    if (input.liked) {
      await addFavorite(ctx.user.id, input.recipeId);

      if (ref.userId) {
        await sendSocialNotification({
          userId: ref.userId,
          actorId: ctx.user.id,
          type: "like",
          recipeId: input.recipeId,
        });
      }
    } else {
      await removeFavorite(ctx.user.id, input.recipeId);
    }

    const favoriteCount = await countRecipeFavorites(input.recipeId);

    return { recipeId: input.recipeId, liked: input.liked, favoriteCount };
  });

// --- Comments -----------------------------------------------------------

function toCommentDto(row: {
  id: string;
  body: string;
  createdAt: Date;
  userId: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
}) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    author: row.authorHandle
      ? {
          handle: row.authorHandle,
          displayName: row.authorDisplayName,
          avatarUrl: row.authorAvatarUrl,
        }
      : null,
  };
}

const getComments = publicProcedure.input(ListCommentsInputSchema).query(async ({ input }) => {
  const { items, nextCursor } = await listCommentsForRecipe(
    input.recipeId,
    input.limit,
    input.cursor
  );

  return { comments: items.map(toCommentDto), nextCursor };
});

const postComment = authedProcedure
  .use(rateLimit({ name: "social.postComment", limit: 8, windowSec: 60 }))
  .input(AddCommentInputSchema)
  .mutation(async ({ ctx, input }) => {
    const ref = await getViewableRecipeRefById(input.recipeId);

    if (!ref) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    // Author display comes from the public profile, so a handle is required.
    const profile = await getProfileByUserId(ctx.user.id);

    if (!profile) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Create your public profile before commenting",
      });
    }

    const { id } = await addComment(ctx.user.id, input.recipeId, input.body);

    if (ref.userId) {
      await sendSocialNotification({
        userId: ref.userId,
        actorId: ctx.user.id,
        type: "comment",
        recipeId: input.recipeId,
      });
    }

    log.info({ userId: ctx.user.id, recipeId: input.recipeId, commentId: id }, "Added comment");

    return { id };
  });

const removeComment = authedProcedure
  .use(rateLimit({ name: "social.removeComment", limit: 20, windowSec: 60 }))
  .input(DeleteCommentInputSchema)
  .mutation(async ({ ctx, input }) => {
    const ownership = await getCommentOwnership(input.commentId);

    if (!ownership) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
    }

    // The comment author or the recipe owner may delete it.
    const isCommentAuthor = ownership.userId === ctx.user.id;
    const publishState = await getRecipePublishState(ctx.user.id, ownership.recipeId);
    const isRecipeOwner = publishState !== null;

    if (!isCommentAuthor && !isRecipeOwner && !ctx.isServerAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You cannot delete this comment" });
    }

    await deleteComment(input.commentId);

    return { id: input.commentId };
  });

const reportCommentProc = authedProcedure
  .use(rateLimit({ name: "social.reportComment", limit: 20, windowSec: 60 }))
  .input(ReportCommentInputSchema)
  .mutation(async ({ ctx, input }) => {
    const ownership = await getCommentOwnership(input.commentId);

    if (!ownership) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
    }

    await reportComment(input.commentId, ctx.user.id);

    // Let the recipe owner know a comment on their recipe was flagged, so they
    // can moderate it. The reporter is the actor but stays hidden in the UI.
    const recipeRef = await getViewableRecipeRefById(ownership.recipeId);

    if (recipeRef?.userId) {
      await sendSocialNotification({
        userId: recipeRef.userId,
        actorId: ctx.user.id,
        type: "report",
        recipeId: ownership.recipeId,
      });
    }

    log.info({ userId: ctx.user.id, commentId: input.commentId }, "Reported comment");

    return { ok: true };
  });

// --- Notifications -------------------------------------------------------

function toNotificationDto(row: {
  id: string;
  type: "follow" | "like" | "comment" | "save" | "report";
  createdAt: Date;
  readAt: Date | null;
  actorHandle: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  recipeSlug: string | null;
  recipeName: string | null;
}) {
  return {
    id: row.id,
    type: row.type,
    createdAt: row.createdAt,
    read: row.readAt !== null,
    actor: row.actorHandle
      ? {
          handle: row.actorHandle,
          displayName: row.actorDisplayName,
          avatarUrl: row.actorAvatarUrl,
        }
      : null,
    recipe: row.recipeSlug ? { slug: row.recipeSlug, name: row.recipeName } : null,
  };
}

const getNotifications = authedProcedure
  .input(ListNotificationsInputSchema)
  .query(async ({ ctx, input }) => {
    const { items, nextCursor } = await listNotifications(ctx.user.id, input.limit, input.cursor);

    return { notifications: items.map(toNotificationDto), nextCursor };
  });

const getUnreadNotificationCount = authedProcedure.query(async ({ ctx }) => {
  const count = await countUnreadNotifications(ctx.user.id);

  return { count };
});

const markNotificationsRead = authedProcedure.mutation(async ({ ctx }) => {
  await markAllNotificationsRead(ctx.user.id);

  return { ok: true };
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

    const ratings = await getAverageRatingsByRecipeIds(items.map((i) => i.id));

    // Rewrite the card thumbnail to the public slug route + attach rating.
    const recipes = items.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      image: item.slug ? toSlugMediaUrl(item.image, item.slug) : null,
      dishColor: item.dishColor,
      totalMinutes: item.totalMinutes,
      publishedAt: item.publishedAt,
      rating: toRatingDto(ratings.get(item.id)),
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

    const [favoriteCount, commentCount, ratingStats, savedFrom] = await Promise.all([
      countRecipeFavorites(ref.recipeId),
      countCommentsForRecipe(ref.recipeId),
      getAverageRating(ref.recipeId),
      getPublicSavedFromAttribution(ref.recipeId),
    ]);

    return {
      recipeId: ref.recipeId,
      slug: input.slug,
      visibility: ref.visibility,
      recipe,
      author,
      favoriteCount,
      commentCount,
      rating: toRatingDto(ratingStats),
      // Fork provenance: when this recipe was saved from another public one, the
      // source's slug + author, shown as a "forked from" credit.
      savedFrom,
    };
  });

// --- Ratings -------------------------------------------------------------

const getMyRecipeRating = authedProcedure
  .input(MyRatingInputSchema)
  .query(async ({ ctx, input }) => {
    const rating = await getUserRating(ctx.user.id, input.recipeId);

    return { recipeId: input.recipeId, rating };
  });

const setRecipeRating = authedProcedure
  .use(rateLimit({ name: "social.setRecipeRating", limit: 30, windowSec: 60 }))
  .input(RateRecipeInputSchema)
  .mutation(async ({ ctx, input }) => {
    if (!(await getViewableRecipeRefById(input.recipeId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    await rateRecipe(ctx.user.id, input.recipeId, input.rating);

    const stats = await getAverageRating(input.recipeId);

    return { recipeId: input.recipeId, rating: input.rating, ...toRatingDto(stats) };
  });

// --- Save / fork a public recipe into your own library ------------------

/** The outcome of a save: a fresh fork, the existing one, or your own recipe. */
type SaveStatus = "created" | "existing" | "own";

const saveRecipe = authedProcedure
  .use(rateLimit({ name: "social.saveRecipe", limit: 15, windowSec: 60 }))
  .input(SaveRecipeInputSchema)
  .mutation(async ({ ctx, input }): Promise<{ recipeId: string; status: SaveStatus }> => {
    const ref = await getViewableRecipeRefById(input.recipeId);

    if (!ref) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    // Saving your own recipe is a no-op: it is already in your library, so just
    // point the caller back at it rather than cloning it onto itself.
    if (ref.userId === ctx.user.id) {
      return { recipeId: input.recipeId, status: "own" };
    }

    // Attribute to (and dedupe against) the ORIGINAL recipe, not an intermediate
    // fork — saving someone's fork of a recipe you already saved should reopen
    // your copy, and forks of forks should all trace to the one root.
    const source = await getRecipeSourceRoot(input.recipeId);
    const rootId = source?.rootId ?? input.recipeId;

    // The root may be your own recipe reached via someone else's fork — you
    // already have it.
    if (source?.rootUserId && source.rootUserId === ctx.user.id) {
      return { recipeId: rootId, status: "own" };
    }

    // Idempotent by root: if you have already saved this recipe, reopen that
    // copy instead of piling up duplicates every time the button is pressed.
    const existingFork = await getSavedForkForUser(ctx.user.id, rootId);

    if (existingFork) {
      return { recipeId: existingFork.recipeId, status: "existing" };
    }

    const full = await getRecipeFull(input.recipeId);

    if (!full) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    const newId = crypto.randomUUID();

    // Copy the gallery pictures into the new recipe's own storage so the fork
    // keeps its image even if the original is later deleted or unpublished.
    // Step images and videos are not copied (a deliberate, lighter fork). A
    // copy that fails is skipped, never fatal — a recipe without its photo is
    // far better than a save that errors out.
    const sourceImages = full.images?.length
      ? full.images
      : full.image
        ? [{ image: full.image, order: 0 }]
        : [];
    const copiedImages: { image: string; order: number }[] = [];

    for (const [idx, img] of sourceImages.entries()) {
      if (!img.image) {
        continue;
      }

      const copiedUrl = await copyRecipeImageByUrl(img.image, newId);

      if (copiedUrl) {
        copiedImages.push({ image: copiedUrl, order: Number(img.order ?? idx) });
      }
    }

    // Deep-copy the content into a new private recipe the caller owns. Step
    // images and step-ingredient links are not copied.
    const dto = {
      name: full.name,
      description: full.description ?? null,
      notes: full.notes ?? null,
      servings: full.servings,
      prepMinutes: full.prepMinutes ?? null,
      cookMinutes: full.cookMinutes ?? null,
      totalMinutes: full.totalMinutes ?? null,
      systemUsed: full.systemUsed,
      calories: full.calories ?? null,
      fat: full.fat ?? null,
      carbs: full.carbs ?? null,
      protein: full.protein ?? null,
      originCountry: full.originCountry ?? null,
      originCountryName: full.originCountryName ?? null,
      originRegion: full.originRegion ?? null,
      provenanceNote: full.provenanceNote ?? null,
      categories: full.categories ?? [],
      recipeIngredients: (full.recipeIngredients ?? []).map((i, idx) => ({
        ingredientName: i.ingredientName,
        ingredientId: i.ingredientId ?? null,
        amount: i.amount ?? null,
        unit: i.unit ?? null,
        systemUsed: i.systemUsed,
        order: i.order ?? idx,
      })),
      tags: (full.tags ?? []).map((t) => t.name),
      cuisines: (full.cuisines ?? []).map((c) => c.id),
      steps: (full.steps ?? []).map((s, idx) => ({
        step: s.step,
        systemUsed: s.systemUsed,
        order: s.order ?? idx,
        images: [],
        stepIngredients: [],
      })),
      images: copiedImages,
      videos: [],
    };

    // Create the fork under an advisory lock keyed on (user, root): two racing
    // saves can both reach here past the check above, so the guard collapses
    // them — the loser gets the winner's copy back as "existing" (its own
    // already-copied images are simply left unreferenced).
    const created = await createSavedForkGuarded(newId, ctx.user.id, rootId, dto);

    if (!created) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save recipe" });
    }

    // Only a genuinely new fork notifies the author; losing the race does not.
    if (created.status === "created" && ref.userId) {
      // Tell the author of the recipe that was actually opened and saved.
      await sendSocialNotification({
        userId: ref.userId,
        actorId: ctx.user.id,
        type: "save",
        recipeId: input.recipeId,
      });
    }

    log.info(
      {
        userId: ctx.user.id,
        sourceRecipeId: input.recipeId,
        rootRecipeId: rootId,
        newRecipeId: created.recipeId,
        status: created.status,
      },
      "Saved (forked) recipe"
    );

    return { recipeId: created.recipeId, status: created.status };
  });

/**
 * Whether the caller can/has saved a given public recipe — drives the Save
 * button's three states without the client guessing: their own recipe (no save
 * offered), a recipe they have already saved (reopen the copy), or a fresh one.
 */
// Public so the save state can be read on the public recipe page without an
// UNAUTHORIZED console error; anonymous callers get isAuthenticated:false and
// no fork, and the client sends them to sign in when they press Save.
const getSaveState = publicProcedure
  .input(SaveRecipeInputSchema)
  .query(
    async ({
      ctx,
      input,
    }): Promise<{ isOwn: boolean; savedRecipeId: string | null; isAuthenticated: boolean }> => {
      const ref = await getViewableRecipeRefById(input.recipeId);

      if (!ref) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }

      if (!ctx.user) {
        return { isOwn: false, savedRecipeId: null, isAuthenticated: false };
      }

      if (ref.userId === ctx.user.id) {
        return { isOwn: true, savedRecipeId: null, isAuthenticated: true };
      }

      // Resolve to the root so the button matches saveRecipe: a fork of your own
      // recipe is "own", and a recipe you saved under any fork reopens your copy.
      const source = await getRecipeSourceRoot(input.recipeId);
      const rootId = source?.rootId ?? input.recipeId;

      if (source?.rootUserId && source.rootUserId === ctx.user.id) {
        return { isOwn: true, savedRecipeId: null, isAuthenticated: true };
      }

      const existingFork = await getSavedForkForUser(ctx.user.id, rootId);

      return { isOwn: false, savedRecipeId: existingFork?.recipeId ?? null, isAuthenticated: true };
    }
  );

/**
 * Where a saved copy was saved from, for the "Saved from …" credit on the
 * recipe page. Returns null unless the caller owns the copy and the source is
 * still publicly reachable — so the credit disappears cleanly if the original
 * goes private or is deleted, and never leaks a private recipe's provenance.
 */
const getSavedFrom = authedProcedure
  .input(SaveRecipeInputSchema)
  .query(async ({ ctx, input }) => getSavedFromAttribution(input.recipeId, ctx.user.id));

const uploadProfileAvatar = authedProcedure
  .use(rateLimit({ name: "social.uploadProfileAvatar", limit: 10, windowSec: 60 }))
  .input(formDataInputSchema)
  .mutation(async ({ ctx, input }) => {
    const file = getUploadedFile(input, "avatar");

    if (!file) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No avatar file provided" });
    }

    if (!ALLOWED_IMAGE_MIME_SET.has(file.type)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only JPEG, PNG, WebP or AVIF images are allowed.",
      });
    }

    if (file.size > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
      const maxMB = Math.round(SERVER_CONFIG.MAX_IMAGE_FILE_SIZE / 1024 / 1024);

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `File too large. Maximum size is ${maxMB}MB.`,
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await saveProfileAvatarBytes(bytes);

    log.info({ userId: ctx.user.id }, "Uploaded profile avatar");

    return { url };
  });

/**
 * Server-global rendering config for the public recipe view (`/r/[slug]`): the
 * unit vocabulary, whether timers are on, and the timer keywords. Public and
 * token-free — a discovered recipe is public — so a signed-out cook's page can
 * localise units and detect timers. Without this the view falls back to an empty
 * unit map and shows canonical unit ids (e.g. "head" instead of "hlava").
 */
const publicRecipeConfig = publicProcedure.query(async () => {
  const [units, timersEnabled, timerKeywords] = await Promise.all([
    getUnits(),
    isTimersEnabled(),
    getTimerKeywords(),
  ]);

  return { units, timersEnabled, timerKeywords };
});

export const socialProcedures = router({
  publicRecipeConfig,
  getMyProfile,
  checkHandle,
  upsertMyProfile,
  uploadProfileAvatar,
  getPublishState,
  setVisibility,
  setVisibilityBulk,
  unpublishImported,
  myRecipesForSharing,
  getProfile,
  profileThemes,
  listProfileRecipes,
  getPublicRecipe,
  follow,
  unfollow,
  getFollowStatus,
  feed,
  forYou,
  discover,
  discoverCategoryCounts,
  discoverCuisineCounts,
  search,
  searchByIngredients,
  trendingTopics,
  discoverThemes,
  themeRecipes,
  themesList,
  themeRecipesBySlug,
  surpriseRecipes,
  relatedRecipes,
  recipeOfTheDay,
  suggestedCooks,
  discoverCooks,
  discoverCookbooks,
  getPublicCookbook,
  listPublicCookbooks,
  getCookbookPublishState: getCookbookPublishStateProc,
  setCookbookVisibility: setCookbookVisibilityProc,
  setCookbookDescription: setCookbookDescriptionProc,
  getLikeStatus,
  toggleLike,
  getComments,
  postComment,
  removeComment,
  reportComment: reportCommentProc,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  getMyRecipeRating,
  setRecipeRating,
  saveRecipe,
  getSaveState,
  getSavedFrom,
});
