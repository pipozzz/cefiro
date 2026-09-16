import { TRPCError } from "@trpc/server";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { PublicRecipeViewDTO } from "@norish/shared/contracts/dto/recipe-shares";
import {
  addFavorite,
  countRecipeFavorites,
  isFavorite,
  removeFavorite,
} from "@norish/db/repositories/favorites";
import {
  getAverageRating,
  getAverageRatingsByRecipeIds,
  getUserRating,
  rateRecipe,
  type RatingStats,
} from "@norish/db/repositories/ratings";
import {
  countUnreadNotifications,
  createNotification,
  listNotifications,
  markAllNotificationsRead,
} from "@norish/db/repositories/notifications";
import {
  addComment,
  countCommentsForRecipe,
  deleteComment,
  getCommentOwnership,
  listCommentsForRecipe,
} from "@norish/db/repositories/recipe-comments";
import { createRecipeWithRefs, getRecipeFull } from "@norish/db/repositories/recipes";
import {
  getProfileByHandle,
  getProfileByUserId,
  getRecipePublishState,
  getViewableRecipeRefById,
  getViewableRecipeRefBySlug,
  isHandleAvailable,
  listPublicRecipesByUserId,
  searchPublicProfiles,
  setRecipeVisibility,
  upsertProfile,
  type PublicProfile,
  type PublicProfileCard,
} from "@norish/db/repositories/user-profiles";
import {
  followUser,
  getFollowCounts,
  isFollowing,
  listDiscoverRecipes,
  listFeedRecipes,
  searchPublicRecipes,
  unfollowUser,
  type FeedRecipeRow,
} from "@norish/db/repositories/follows";
import {
  getCookbookPublishState,
  getPublicCookbookBySlug,
  listPublicCookbooksByUserId,
  setCookbookDescription,
  setCookbookVisibility,
  type PublicCookbookCard,
} from "@norish/db/repositories/public-cookbooks";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { PublicRecipeViewSchema } from "@norish/shared/contracts/zod/recipe-shares";
import {
  AddCommentInputSchema,
  CheckHandleInputSchema,
  DeleteCommentInputSchema,
  DiscoverInputSchema,
  FeedInputSchema,
  FollowByHandleInputSchema,
  GetProfileByHandleInputSchema,
  GetPublicRecipeBySlugInputSchema,
  LikeStatusInputSchema,
  ListCommentsInputSchema,
  ListNotificationsInputSchema,
  ListPublicRecipesByHandleInputSchema,
  MyRatingInputSchema,
  CookbookPublishStateInputSchema,
  GetPublicCookbookBySlugInputSchema,
  ListPublicCookbooksByHandleInputSchema,
  RateRecipeInputSchema,
  SaveRecipeInputSchema,
  SearchInputSchema,
  SetCookbookDescriptionInputSchema,
  SetCookbookVisibilityInputSchema,
  SetRecipeVisibilityInputSchema,
  ToggleLikeInputSchema,
  UpsertProfileInputSchema,
} from "@norish/shared/contracts/zod";

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

function toFeedCard(row: FeedRecipeRow) {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.slug ? toSlugMediaUrl(row.image, row.slug) : null,
    dishColor: row.dishColor,
    totalMinutes: row.totalMinutes,
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

const checkHandle = authedProcedure
  .input(CheckHandleInputSchema)
  .query(async ({ ctx, input }) => {
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

    const counts = await getFollowCounts(profile.userId);

    return { profile: toPublicProfileDto(profile), counts };
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
    await createNotification({ userId, actorId: ctx.user.id, type: "follow" });

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
const getFollowStatus = authedProcedure
  .input(FollowByHandleInputSchema)
  .query(async ({ ctx, input }) => {
    const profile = await getProfileByHandle(input.handle);

    if (!profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    }

    const isSelf = profile.userId === ctx.user.id;
    const following = isSelf ? false : await isFollowing(ctx.user.id, profile.userId);

    return { handle: input.handle, isSelf, isFollowing: following };
  });

// --- Feed & discovery ---------------------------------------------------

const feed = authedProcedure.input(FeedInputSchema).query(async ({ ctx, input }) => {
  const { items, nextCursor } = await listFeedRecipes(ctx.user.id, input.limit, input.cursor);

  return { recipes: await toFeedCardsWithRatings(items), nextCursor };
});

const discover = publicProcedure.input(DiscoverInputSchema).query(async ({ input }) => {
  const { items, nextCursor } = await listDiscoverRecipes({
    sort: input.sort,
    category: input.category,
    limit: input.limit,
    cursor: input.cursor,
  });

  return { recipes: await toFeedCardsWithRatings(items), nextCursor };
});

// --- Search -------------------------------------------------------------

const search = publicProcedure.input(SearchInputSchema).query(async ({ input }) => {
  const [recipeRows, profileRows] = await Promise.all([
    searchPublicRecipes(input.q, input.limit),
    searchPublicProfiles(input.q, input.limit),
  ]);

  return {
    recipes: await toFeedCardsWithRatings(recipeRows),
    profiles: profileRows.map(toProfileCard),
  };
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

const getLikeStatus = authedProcedure
  .input(LikeStatusInputSchema)
  .query(async ({ ctx, input }) => {
    const liked = await isFavorite(ctx.user.id, input.recipeId);

    return { recipeId: input.recipeId, liked };
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
        await createNotification({
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
    await createNotification({
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

// --- Notifications -------------------------------------------------------

function toNotificationDto(row: {
  id: string;
  type: "follow" | "like" | "comment";
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

    const [favoriteCount, commentCount, ratingStats] = await Promise.all([
      countRecipeFavorites(ref.recipeId),
      countCommentsForRecipe(ref.recipeId),
      getAverageRating(ref.recipeId),
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

const saveRecipe = authedProcedure
  .use(rateLimit({ name: "social.saveRecipe", limit: 15, windowSec: 60 }))
  .input(SaveRecipeInputSchema)
  .mutation(async ({ ctx, input }) => {
    const ref = await getViewableRecipeRefById(input.recipeId);

    if (!ref) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    const full = await getRecipeFull(input.recipeId);

    if (!full) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    // Deep-copy the content into a new private recipe the caller owns. Media
    // (images/videos) and step-ingredient links are not copied — they belong
    // to the source recipe's storage.
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
      images: [],
      videos: [],
    };

    const newId = crypto.randomUUID();
    const created = await createRecipeWithRefs(newId, ctx.user.id, dto);

    if (!created) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save recipe" });
    }

    log.info(
      { userId: ctx.user.id, sourceRecipeId: input.recipeId, newRecipeId: created.recipeId },
      "Saved (forked) recipe"
    );

    return { recipeId: created.recipeId };
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
  follow,
  unfollow,
  getFollowStatus,
  feed,
  discover,
  search,
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
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  getMyRecipeRating,
  setRecipeRating,
  saveRecipe,
});
