/**
 * Discover theme clustering (Phase B2).
 *
 * Groups the public recipe embeddings into semantic clusters, names each one,
 * and rebuilds the `themes` table. Runs weekly on the scheduler, and on demand
 * from the admin AI panel. Off when embeddings are not configured — there is
 * nothing to cluster without vectors.
 *
 * Naming is best-effort: the AI namer produces a language-appropriate label, and
 * when it is unavailable the cluster's dominant tag (or its representative
 * recipe's title) stands in. A cluster we cannot name at all is dropped rather
 * than shown blank.
 */

import type { ThemeInput } from "@norish/db/repositories/themes";
import { listPublicRecipeEmbeddings } from "@norish/db/repositories/recipe-embeddings";
import {
  getRecipeDisplayById,
  getRecipeNamesByIds,
  getTopTagsForRecipeIds,
  replaceThemes,
} from "@norish/db/repositories/themes";
import { isEmbeddingConfigured } from "@norish/shared-server/ai/embeddings/voyage";
import {
  clusterEmbeddings,
  nearestMembers,
  representativeOf,
} from "@norish/shared-server/ai/themes/cluster";
import { nameTheme } from "@norish/shared-server/ai/themes/theme-namer";
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("scheduler:theme-clustering");

const PAGE_SIZE = 500;
/** How many of a cluster's nearest recipes to show the namer. */
const TITLES_FOR_NAMING = 8;
/** How many dominant tags to derive per cluster. */
const TAGS_PER_CLUSTER = 5;

export interface ThemeRebuildResult {
  /** Public recipes considered (all had embeddings). */
  recipes: number;
  /** Themes written. */
  themes: number;
}

/** Load every public recipe embedding, one page at a time. */
async function loadAllEmbeddings(): Promise<{ recipeId: string; embedding: number[] }[]> {
  const items: { recipeId: string; embedding: number[] }[] = [];
  let afterRecipeId: string | undefined;

  for (;;) {
    const page = await listPublicRecipeEmbeddings(PAGE_SIZE, afterRecipeId);

    if (page.length === 0) break;
    items.push(...page);
    if (page.length < PAGE_SIZE) break;
    afterRecipeId = page[page.length - 1]!.recipeId;
  }

  return items;
}

export async function rebuildDiscoverThemes(): Promise<ThemeRebuildResult> {
  if (!isEmbeddingConfigured()) {
    log.info("Embeddings not configured; skipping theme clustering");

    return { recipes: 0, themes: 0 };
  }

  const items = await loadAllEmbeddings();
  const clusters = clusterEmbeddings(items);

  if (clusters.length === 0) {
    // Too few recipes to cluster (or none): clear stale themes and stop.
    await replaceThemes([]);
    log.info({ recipes: items.length }, "Not enough recipes to cluster; themes cleared");

    return { recipes: items.length, themes: 0 };
  }

  const embeddingById = new Map(items.map((item) => [item.recipeId, item.embedding]));
  const rows: ThemeInput[] = [];

  for (const cluster of clusters) {
    const nearest = nearestMembers(cluster, embeddingById, TITLES_FOR_NAMING);
    const nameByRecipe = await getRecipeNamesByIds(nearest);
    const titles = nearest
      .map((recipeId) => nameByRecipe.get(recipeId))
      .filter((title): title is string => Boolean(title));
    const topTags = await getTopTagsForRecipeIds(cluster.memberIds, TAGS_PER_CLUSTER);

    const aiName = await nameTheme({ titles, tags: topTags });
    const name = aiName ?? topTags[0] ?? titles[0] ?? null;

    if (!name) {
      // Nothing to label this cluster with; better no tile than a blank one.
      continue;
    }

    const representativeRecipeId = representativeOf(cluster, embeddingById);
    const display = representativeRecipeId
      ? await getRecipeDisplayById(representativeRecipeId)
      : null;

    rows.push({
      name,
      recipeCount: cluster.memberIds.length,
      centroid: cluster.centroid,
      representativeRecipeId,
      slug: display?.slug ?? null,
      image: display?.image ?? null,
      rank: rows.length,
    });
  }

  await replaceThemes(rows);
  log.info({ recipes: items.length, themes: rows.length }, "Discover themes rebuilt");

  return { recipes: items.length, themes: rows.length };
}
