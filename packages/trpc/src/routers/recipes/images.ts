import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  addRecipeImages,
  countRecipeImages,
  deleteRecipeImageById,
  getRecipeImageById,
  getRecipeOwnerId,
} from "@norish/db/repositories/recipes";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { refreshDishColorForRecipe } from "@norish/shared-server/media/dish-color";
import {
  deleteImageByUrl,
  deleteStepImageByUrl,
  saveImageBytes,
  saveStepImageBytes,
} from "@norish/shared-server/media/storage";
import { ALLOWED_IMAGE_MIME_SET } from "@norish/shared/contracts";
import { DeleteRecipeImageInputSchema, MAX_RECIPE_IMAGES } from "@norish/shared/contracts/zod";

import type { FormDataInput, UploadedFile } from "../../form-data";
import { formDataInputSchema, getUploadedFile } from "../../form-data";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

// --- Shared Helpers ---

type ImageValidationResult =
  { success: true; file: UploadedFile; bytes: Buffer } | { success: false; error: string };

/**
 * Extract and validate image file from FormData.
 * Consolidates all the repetitive validation logic.
 */
async function extractAndValidateImage(formData: FormDataInput): Promise<ImageValidationResult> {
  const file = getUploadedFile(formData, "image");

  if (!file) {
    return { success: false, error: "No image file provided" };
  }

  if (!ALLOWED_IMAGE_MIME_SET.has(file.type)) {
    return {
      success: false,
      error: "Invalid file type. Only JPEG, PNG, WebP, and AVIF images are allowed.",
    };
  }

  if (file.size > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    const maxMB = Math.round(SERVER_CONFIG.MAX_IMAGE_FILE_SIZE / 1024 / 1024);

    return { success: false, error: `File too large. Maximum size is ${maxMB}MB.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  return { success: true, file, bytes };
}

/**
 * Upload a recipe image (FormData input)
 * Requires recipeId to save to: uploads/recipes/{recipeId}/{hash}.jpg
 */
const uploadImage = authedProcedure.input(formDataInputSchema).mutation(async ({ ctx, input }) => {
  const recipeId = input.get("recipeId") as string | null;

  log.debug({ userId: ctx.user.id, recipeId }, "Uploading recipe image");

  if (!recipeId) {
    return { success: false, error: "Recipe ID is required" };
  }

  const validation = await extractAndValidateImage(input);

  if (!validation.success) {
    return validation;
  }

  try {
    const url = await saveImageBytes(validation.bytes, recipeId);

    log.info({ userId: ctx.user.id, recipeId, url }, "Recipe image uploaded");

    return { success: true, url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload image";

    log.error({ userId: ctx.user.id, recipeId, error }, "Failed to upload recipe image");

    return { success: false, error: message };
  }
});

/**
 * Delete a recipe image by URL
 * URL format: /recipes/{recipeId}/{hash}.jpg
 */
const deleteImage = authedProcedure
  .input(z.object({ url: z.string() }))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, url: input.url }, "Deleting recipe image");

    // Ensure we're only deleting recipe images (not avatars or other files)
    if (!input.url.startsWith("/recipes/")) {
      return { success: false, error: "Invalid image URL format" };
    }

    try {
      await deleteImageByUrl(input.url);

      log.info({ userId: ctx.user.id, url: input.url }, "Recipe image deleted");

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete image";

      log.error({ userId: ctx.user.id, error }, "Failed to delete recipe image");

      return { success: false, error: message };
    }
  });

/**
 * Upload a step image (FormData input with recipeId)
 * Images are stored in: uploads/recipes/{recipeId}/steps/{hash}.jpg
 */
const uploadStepImage = authedProcedure
  .input(formDataInputSchema)
  .mutation(async ({ ctx, input }) => {
    const recipeId = input.get("recipeId") as string | null;

    log.debug({ userId: ctx.user.id, recipeId }, "Uploading step image");

    if (!recipeId) {
      return { success: false, error: "Recipe ID is required" };
    }

    const validation = await extractAndValidateImage(input);

    if (!validation.success) {
      return validation;
    }

    try {
      const url = await saveStepImageBytes(validation.bytes, recipeId);

      log.info({ userId: ctx.user.id, recipeId, url }, "Step image uploaded");

      return { success: true, url };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload step image";

      log.error({ userId: ctx.user.id, recipeId, error }, "Failed to upload step image");

      return { success: false, error: message };
    }
  });

const deleteStepImage = authedProcedure
  .input(z.object({ url: z.string() }))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, url: input.url }, "Deleting step image");

    try {
      await deleteStepImageByUrl(input.url);

      log.info({ userId: ctx.user.id, url: input.url }, "Step image deleted");

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete step image";

      log.warn({ userId: ctx.user.id, error, url: input.url }, "Could not delete step image");

      return { success: false, error: message };
    }
  });

// --- Gallery Image Procedures ---

/**
 * Upload a gallery image (FormData input with recipeId)
 * Images are stored in: uploads/recipes/{recipeId}/{hash}.jpg
 * Also adds entry to recipe_images table
 */
const uploadGalleryImage = authedProcedure
  .input(formDataInputSchema)
  .mutation(async ({ ctx, input }) => {
    const recipeId = input.get("recipeId") as string | null;
    const orderStr = input.get("order") as string | null;

    log.debug({ userId: ctx.user.id, recipeId }, "Uploading gallery image");

    if (!recipeId) {
      return { success: false, error: "Recipe ID is required" };
    }

    // Check max images limit
    const currentCount = await countRecipeImages(recipeId);

    if (currentCount >= MAX_RECIPE_IMAGES) {
      return {
        success: false,
        error: `Maximum ${MAX_RECIPE_IMAGES} images allowed per recipe`,
      };
    }

    const validation = await extractAndValidateImage(input);

    if (!validation.success) {
      return validation;
    }

    try {
      // Gallery images go to uploads/recipes/{recipeId}/{hash}.jpg
      const url = await saveImageBytes(validation.bytes, recipeId);

      // Parse order, default to current count (append to end)
      const order = orderStr ? parseInt(orderStr, 10) : currentCount;

      // Check if recipe exists in database before inserting into recipe_images
      // For new recipes (created via form), the recipe doesn't exist yet - images will be
      // linked when the recipe is saved via createRecipeWithRefs
      const recipeOwner = await getRecipeOwnerId(recipeId);

      if (recipeOwner !== null) {
        // Recipe exists, add to database
        const [imageRecord] = await addRecipeImages(recipeId, [{ image: url, order }]);

        if (!imageRecord) {
          return { success: false, error: "Failed to create image record" };
        }

        const versionedImageRecord = imageRecord as typeof imageRecord & { version: number };

        // A gallery upload on a stored recipe can change what the page leads
        // with; the Dish Colour follows the new hero (ADR-0023).
        await refreshDishColorForRecipe(recipeId);

        log.info(
          { userId: ctx.user.id, recipeId, url, imageId: imageRecord.id },
          "Gallery image uploaded"
        );

        return {
          success: true,
          url,
          id: imageRecord.id,
          order: imageRecord.order,
          version: versionedImageRecord.version,
        };
      } else {
        // Recipe doesn't exist yet (new recipe form), just return the URL
        // The image will be linked when the recipe is created
        log.info(
          { userId: ctx.user.id, recipeId, url },
          "Gallery image uploaded for pending recipe"
        );

        return { success: true, url, order };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload gallery image";

      log.error({ userId: ctx.user.id, recipeId, error }, "Failed to upload gallery image");

      return { success: false, error: message };
    }
  });

/**
 * Delete a gallery image by ID
 * Removes from database and filesystem
 */
const deleteGalleryImage = authedProcedure
  .input(DeleteRecipeImageInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, imageId: input.imageId }, "Deleting gallery image");

    try {
      // Get image record to get the URL
      const imageRecord = await getRecipeImageById(input.imageId);

      if (!imageRecord) {
        return { success: false, error: "Image not found" };
      }

      // Delete from filesystem
      try {
        await deleteImageByUrl(imageRecord.image);
      } catch (fsError) {
        // Log but don't fail - file might already be deleted
        log.warn(
          { userId: ctx.user.id, imageId: input.imageId, error: fsError },
          "Could not delete gallery image file"
        );
      }

      // Delete from database
      const result = await deleteRecipeImageById(input.imageId, input.version);

      if (result.stale) {
        log.info(
          { userId: ctx.user.id, imageId: input.imageId, version: input.version },
          "Ignoring stale gallery image delete"
        );

        return { success: true, stale: true };
      }

      // Deleting the hero image changes what the page leads with; the Dish
      // Colour follows what is left (ADR-0023).
      await refreshDishColorForRecipe(imageRecord.recipeId);

      log.info(
        { userId: ctx.user.id, imageId: input.imageId, url: imageRecord.image },
        "Gallery image deleted"
      );

      return { success: true, stale: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete gallery image";

      log.error(
        { userId: ctx.user.id, imageId: input.imageId, error },
        "Failed to delete gallery image"
      );

      return { success: false, error: message };
    }
  });

/**
 * Public API: attach a gallery image to a recipe from base64 bytes (JSON, not
 * multipart), so an HTTP/MCP caller can add a photo without a form upload. Saves
 * the bytes through the media storage, records the image, and refreshes the dish
 * colour. Only attach images you have the right to publish.
 */
const addImageApi = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/recipes/{id}/images",
      protect: true,
      tags: ["Recipes"],
      summary: "Add a recipe image",
      description:
        "Attach a gallery image from base64-encoded bytes. Only add images you have the right to publish.",
      errorResponses: {
        400: "Invalid image type, empty data, or image limit reached",
        401: "Missing or invalid API credentials",
        403: "Not your recipe",
        404: "Recipe not found",
        413: "Image too large",
      },
    },
  })
  .input(
    z.object({
      id: z.uuid(),
      data: z.string().min(1).describe("Base64-encoded image bytes"),
      mimeType: z.string().describe("image/jpeg, image/png, image/webp or image/avif"),
      order: z.number().int().nonnegative().optional(),
    })
  )
  .output(z.object({ id: z.uuid(), url: z.string(), order: z.number().int() }))
  .mutation(async ({ ctx, input }) => {
    const owner = await getRecipeOwnerId(input.id);

    if (owner === null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    if (owner !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your recipe" });
    }

    if (!ALLOWED_IMAGE_MIME_SET.has(input.mimeType)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid image type. Allowed: JPEG, PNG, WebP, AVIF.",
      });
    }

    const bytes = Buffer.from(input.data, "base64");

    if (bytes.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Image data is empty or not base64." });
    }

    if (bytes.length > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
      const maxMB = Math.round(SERVER_CONFIG.MAX_IMAGE_FILE_SIZE / 1024 / 1024);

      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message: `Image too large (max ${maxMB}MB).`,
      });
    }

    if ((await countRecipeImages(input.id)) >= MAX_RECIPE_IMAGES) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Maximum ${MAX_RECIPE_IMAGES} images per recipe.`,
      });
    }

    const url = await saveImageBytes(bytes, input.id);
    const order = input.order ?? (await countRecipeImages(input.id));
    const [record] = await addRecipeImages(input.id, [{ image: url, order }]);

    if (!record) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to record image" });
    }

    await refreshDishColorForRecipe(input.id);
    log.info({ userId: ctx.user.id, recipeId: input.id, url }, "Recipe image added (API)");

    return { id: record.id, url, order: Number(record.order) };
  });

export const imagesProcedures = router({
  uploadImage,
  deleteImage,
  uploadStepImage,
  deleteStepImage,
  uploadGalleryImage,
  deleteGalleryImage,
  addImageApi,
});
