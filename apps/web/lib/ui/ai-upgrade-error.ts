import { TRPCClientError } from "@trpc/client";

/**
 * Whether a mutation failed because the caller has hit an AI entitlement gate —
 * the monthly AI-credit limit, or a plan that lacks AI image generation. Both
 * are thrown as FORBIDDEN by the AI import/enrichment procedures
 * (packages/trpc/src/routers/recipes/recipes.ts) with these stable messages, so
 * the client can turn them into an "upgrade" prompt rather than a generic
 * failure. Other FORBIDDEN errors (e.g. editing a recipe you don't own) do not
 * match and fall through to normal error handling.
 */
export function isAiUpgradeError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) {
    return false;
  }

  if (error.data?.code !== "FORBIDDEN") {
    return false;
  }

  const message = error.message ?? "";

  return /monthly AI limit/i.test(message) || /upgraded plan/i.test(message);
}
