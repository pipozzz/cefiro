import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { groceries } from "@norish/db-schema/schema";

import { clientMintedId } from "./common";

export const PurchaseAmountSchema = z.number().positive().max(9999999).nullable().optional();

export const GrocerySelectBaseSchema = createSelectSchema(groceries)
  .omit({
    userId: true,
    recurringGroceryId: true,
    storeId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    amount: z.coerce.number().nullable(),
    purchaseAmount: z.coerce.number().nullable().optional(),
    recipeIngredientId: z.uuid().nullable(),
    recurringGroceryId: z.uuid().nullable(),
    storeId: z.uuid().nullable(),
    sortOrder: z.number().int(),
  });

// Insert schema with explicit fields to avoid drizzle-zod type inference issues
export const GroceryInsertBaseSchema = z.object({
  purchaseAmount: PurchaseAmountSchema,
  userId: z.string(),
  name: z.string().nullable(),
  unit: z.string().nullable(),
  amount: z.coerce.number().nullable(),
  isDone: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  recipeIngredientId: z.uuid().nullable(),
  recurringGroceryId: z.uuid().nullable(),
  storeId: z.uuid().nullable().optional(),
});

// Base update schema with explicit field definitions
export const GroceryUpdateBaseSchema = z.object({
  purchaseAmount: PurchaseAmountSchema,
  id: z.uuid(),
  version: z.number().int().positive().optional(),
  name: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  amount: z.coerce.number().nullable().optional(),
  isDone: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  userId: z.string().optional(),
  recipeIngredientId: z.uuid().nullable().optional(),
  recurringGroceryId: z.uuid().nullable().optional(),
  storeId: z.uuid().nullable().optional(),
});

const GroceryVersionInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

const GroceryStoreReorderInputSchema = GroceryVersionInputSchema.extend({
  sortOrder: z.number().int().min(0),
  storeId: z.uuid().nullable().optional(),
});

// Create schema without userId (added server-side)
export const GroceryCreateSchema = z.object({
  purchaseAmount: PurchaseAmountSchema,
  id: clientMintedId,
  name: z.string().nullable(),
  unit: z.string().nullable(),
  amount: z.coerce.number().nullable(),
  isDone: z.boolean().default(false),
  recipeIngredientId: z.uuid().nullable().optional(),
  recurringGroceryId: z.uuid().nullable().optional(),
  storeId: z.uuid().nullable().optional(),
});

/**
 * "Generate shopping list from the meal plan": aggregate the ingredients of
 * every recipe planned in the [from, to] date window into groceries. Dates are
 * plain YYYY-MM-DD (matching planned_items.date).
 */
export const GenerateGroceriesFromPlanInputSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid from date"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid to date"),
});

// tRPC input schemas
export const GroceryUpdateInputSchema = z.object({
  purchaseAmount: PurchaseAmountSchema,
  groceryId: z.string(),
  raw: z.string(),
  version: z.number().int().positive(),
  storeId: z.uuid().nullable().optional(),
});

export const DetachRecurringGroceryInputSchema = z.object({
  purchaseAmount: PurchaseAmountSchema,
  recurringGroceryId: z.uuid(),
  recurringVersion: z.number().int().positive(),
  groceryId: z.uuid(),
  groceryVersion: z.number().int().positive(),
  raw: z.string(),
  storeId: z.uuid().nullable().optional(),
});

export const GroceryToggleSchema = z.object({
  groceries: z.array(GroceryVersionInputSchema),
  isDone: z.boolean(),
});

export const GroceryDeleteSchema = z.object({
  groceries: z.array(GroceryVersionInputSchema),
});

export const AssignGroceryToStoreInputSchema = z.object({
  groceryId: z.uuid(),
  version: z.number().int().positive(),
  storeId: z.uuid().nullable(),
  savePreference: z.boolean().default(true),
});

export const ReorderGroceriesInStoreInputSchema = z.object({
  updates: z.array(GroceryStoreReorderInputSchema),
  savePreference: z.boolean().default(true),
});

export const MarkAllDoneGroceriesInputSchema = z.object({
  storeId: z.uuid().nullable(),
  groceries: z.array(GroceryVersionInputSchema),
});

export const DeleteDoneGroceriesInputSchema = z.object({
  storeId: z.uuid().nullable(),
  groceries: z.array(GroceryVersionInputSchema),
});
