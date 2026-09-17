import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./router";

export type { AppRouter } from "./router";

/** Inferred input types for every procedure, keyed by router path. */
export type RouterInputs = inferRouterInputs<AppRouter>;

/** Inferred output types for every procedure, keyed by router path. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
