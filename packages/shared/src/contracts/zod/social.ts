import { z } from "zod";

/**
 * Social layer (cefiro) contracts: public profiles, recipe publishing and
 * public reads by slug/handle.
 */

// Handles that would collide with app routes or look like impersonation.
export const RESERVED_HANDLES = [
  "admin",
  "api",
  "app",
  "auth",
  "login",
  "logout",
  "signup",
  "settings",
  "recipes",
  "recipe",
  "cookbooks",
  "share",
  "r",
  "u",
  "me",
  "explore",
  "discover",
  "feed",
  "search",
  "about",
  "help",
  "support",
  "norish",
  "cefiro",
  "root",
  "system",
] as const;

/**
 * A public handle: 3–30 chars, lowercase letters/digits/underscore, must start
 * with a letter, no trailing underscore, not reserved. Input is lowercased
 * before validation so callers may pass mixed case.
 */
export const HandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Handle must be at least 3 characters")
  .max(30, "Handle must be at most 30 characters")
  .regex(
    /^[a-z][a-z0-9_]*[a-z0-9]$/,
    "Handle must start with a letter, contain only letters, digits or underscore, and not end with an underscore"
  )
  .refine(
    (h) => !RESERVED_HANDLES.includes(h as (typeof RESERVED_HANDLES)[number]),
    "This handle is reserved"
  );

export const recipeVisibilityValues = ["private", "unlisted", "public"] as const;
export const RecipeVisibilitySchema = z.enum(recipeVisibilityValues);

export const UpsertProfileInputSchema = z.object({
  handle: HandleSchema,
  displayName: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
  avatarUrl: z.string().trim().url().max(2048).optional().nullable().or(z.literal("")),
  location: z.string().trim().max(120).optional().nullable(),
  websiteUrl: z.string().trim().url().max(2048).optional().nullable().or(z.literal("")),
  isPublic: z.boolean().optional(),
});

export const CheckHandleInputSchema = z.object({
  handle: HandleSchema,
});

export const GetProfileByHandleInputSchema = z.object({
  handle: z.string().trim().toLowerCase().min(1).max(30),
});

export const SetRecipeVisibilityInputSchema = z.object({
  recipeId: z.uuid(),
  visibility: RecipeVisibilitySchema,
});

export const SetRecipeVisibilityBulkInputSchema = z.object({
  recipeIds: z.array(z.uuid()).min(1).max(200),
  visibility: RecipeVisibilitySchema,
});

export const GetPublicRecipeBySlugInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Invalid slug"),
});

export const ListPublicRecipesByHandleInputSchema = z.object({
  handle: z.string().trim().toLowerCase().min(1).max(30),
  limit: z.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

// --- Public cookbooks ---------------------------------------------------

export const GetPublicCookbookBySlugInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Invalid slug"),
});

export const ListPublicCookbooksByHandleInputSchema = z.object({
  handle: z.string().trim().toLowerCase().min(1).max(30),
});

export const CookbookPublishStateInputSchema = z.object({
  cookbookId: z.uuid(),
});

export const SetCookbookVisibilityInputSchema = z.object({
  cookbookId: z.uuid(),
  visibility: RecipeVisibilitySchema,
});

export const SetCookbookDescriptionInputSchema = z.object({
  cookbookId: z.uuid(),
  description: z.string().trim().max(500).nullable(),
});

// --- Follow graph, feed & discovery -------------------------------------

export const FollowByHandleInputSchema = z.object({
  handle: z.string().trim().toLowerCase().min(1).max(30),
});

export const FeedInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

export const discoverSortValues = ["newest", "trending"] as const;
export const DiscoverSortSchema = z.enum(discoverSortValues);

export const recipeCategoryValues = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

export const DiscoverInputSchema = z.object({
  sort: DiscoverSortSchema.default("newest"),
  category: z.enum(recipeCategoryValues).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  // Cuisine name filter (matched case-insensitively against the vocabulary).
  cuisine: z.string().trim().min(1).max(80).optional(),
  // "Ready in ≤N minutes" quick filter (total time).
  maxMinutes: z.number().int().min(1).max(1440).optional(),
  // Dietary-aware discovery: when true, the server excludes recipes tagged with
  // any of the signed-in reader's allergen tags. A boolean only — the actual
  // allergens are resolved server-side from the session, never sent in the URL.
  hideMyAllergens: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

// --- Search -------------------------------------------------------------

export const SearchInputSchema = z.object({
  q: z.string().trim().min(2, "Search for at least 2 characters").max(100),
  limit: z.number().int().min(1).max(50).default(20),
});

/** "Cook with what you have": discover public recipes by ingredients on hand. */
export const SearchByIngredientsInputSchema = z.object({
  ingredients: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  limit: z.number().int().min(1).max(50).default(24),
});

/** Trending discovery topics: the most-used tags across public recipes. */
export const TrendingTopicsInputSchema = z.object({
  limit: z.number().int().min(1).max(30).default(12),
});

/** "Surprise me": a random handful of public recipes. */
export const SurpriseRecipesInputSchema = z.object({
  limit: z.number().int().min(1).max(24).default(9),
});

/** "More like this": public recipes sharing tags with the given recipe. */
export const RelatedRecipesInputSchema = z.object({
  recipeId: z.uuid(),
  limit: z.number().int().min(1).max(24).default(6),
});

export const SuggestedCooksInputSchema = z.object({
  limit: z.number().int().min(1).max(24).default(6),
});

export const DiscoverCooksInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

export const DiscoverCookbooksInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

// --- Likes & comments ---------------------------------------------------

export const ToggleLikeInputSchema = z.object({
  recipeId: z.uuid(),
  liked: z.boolean(),
});

export const LikeStatusInputSchema = z.object({
  recipeId: z.uuid(),
});

export const ListCommentsInputSchema = z.object({
  recipeId: z.uuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const AddCommentInputSchema = z.object({
  recipeId: z.uuid(),
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});

export const DeleteCommentInputSchema = z.object({
  commentId: z.uuid(),
});

export const ReportCommentInputSchema = z.object({
  commentId: z.uuid(),
});

// --- Save / fork ---------------------------------------------------------

export const SaveRecipeInputSchema = z.object({
  recipeId: z.uuid(),
});

// --- Ratings -------------------------------------------------------------

export const RateRecipeInputSchema = z.object({
  recipeId: z.uuid(),
  rating: z.number().int().min(1).max(5),
});

export const MyRatingInputSchema = z.object({
  recipeId: z.uuid(),
});

// --- Notifications -------------------------------------------------------

export const ListNotificationsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type UpsertProfileInput = z.infer<typeof UpsertProfileInputSchema>;
export type RecipeVisibility = z.infer<typeof RecipeVisibilitySchema>;
export type DiscoverSort = z.infer<typeof DiscoverSortSchema>;
