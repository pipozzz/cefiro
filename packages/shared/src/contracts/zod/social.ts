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
  limit: z.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

export type UpsertProfileInput = z.infer<typeof UpsertProfileInputSchema>;
export type RecipeVisibility = z.infer<typeof RecipeVisibilitySchema>;
export type DiscoverSort = z.infer<typeof DiscoverSortSchema>;
