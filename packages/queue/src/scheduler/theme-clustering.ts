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
import { generateImage } from "@norish/shared-server/ai/runtime/runtime";
import {
  clusterEmbeddings,
  nearestMembers,
  representativeOf,
} from "@norish/shared-server/ai/themes/cluster";
import { nameTheme } from "@norish/shared-server/ai/themes/theme-namer";
import { isImageGenerationConfigured } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { getObjectStore } from "@norish/shared-server/media/object-store";
import { saveGeneratedThemeImageBytes } from "@norish/shared-server/media/storage";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";

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
  // Distinct labels only. When AI naming is unavailable, several clusters fall
  // back to their dominant tag and can collide (two "jednoduché" tiles); track
  // what's used and pick the first non-colliding candidate, disambiguating with a
  // secondary tag when everything collides.
  const usedNames = new Set<string>();

  for (const cluster of clusters) {
    const nearest = nearestMembers(cluster, embeddingById, TITLES_FOR_NAMING);
    const nameByRecipe = await getRecipeNamesByIds(nearest);
    const titles = nearest
      .map((recipeId) => nameByRecipe.get(recipeId))
      .filter((title): title is string => Boolean(title));
    const topTags = await getTopTagsForRecipeIds(cluster.memberIds, TAGS_PER_CLUSTER);

    const aiName = await nameTheme({ titles, tags: topTags });
    const name = pickDistinctThemeName(aiName, topTags, titles, usedNames);

    if (!name) {
      // Nothing to label this cluster with; better no tile than a blank one.
      continue;
    }

    usedNames.add(name.toLowerCase());

    const representativeRecipeId = representativeOf(cluster, embeddingById);
    const display = representativeRecipeId
      ? await getRecipeDisplayById(representativeRecipeId)
      : null;

    // Only synthesise a tile image when the cluster's representative recipe has
    // no real photo. A genuine recipe photo is more distinct and appealing than
    // an AI scene from a generic brief (those come out looking alike), and this
    // avoids an image-model call per theme on every rebuild.
    const generatedImage = display?.image ? null : await generateThemeImageUrl(name, topTags);

    rows.push({
      name,
      recipeCount: cluster.memberIds.length,
      centroid: cluster.centroid,
      representativeRecipeId,
      slug: display?.slug ?? null,
      image: display?.image ?? null,
      generatedImage,
      rank: rows.length,
    });
  }

  await replaceThemes(rows);
  log.info({ recipes: items.length, themes: rows.length }, "Discover themes rebuilt");

  return { recipes: items.length, themes: rows.length };
}

/**
 * The theme subject appended to the theme-style prompt. The prompt owns the
 * style (a creative flat-lay collage, not a plated dish); this only names the
 * theme and the ingredients/dishes that characterise it.
 */
function themeVisualBrief(name: string, topTags: string[]): string {
  const tags = topTags.slice(0, 5).filter(Boolean).join(", ");

  return tags ? `"${name}" — featuring ${tags}.` : `"${name}".`;
}

/**
 * Generate (or reuse) a tile image for a theme and return its public URL, or
 * null when image generation is off or fails. The file is keyed by a slug of the
 * theme name, so an unchanged theme reuses its existing image on the next weekly
 * rebuild instead of re-billing the image model. Never throws — a failed image
 * just leaves the tile to fall back to the representative recipe's photo.
 */
async function generateThemeImageUrl(name: string, topTags: string[]): Promise<string | null> {
  if (!(await isImageGenerationConfigured())) {
    return null;
  }

  const slug = cuisineSlug(name);

  if (!slug) {
    return null;
  }

  try {
    // Reuse an already-generated tile (WebP). A pre-WebP `.jpg` is intentionally
    // not reused, so the next rebuild regenerates it as the smaller WebP.
    if (await getObjectStore().exists(`themes/${slug}.webp`)) {
      return `/themes/${slug}.webp`;
    }

    const image = await generateImage({
      prompt: "image-generation-theme-style",
      sections: [themeVisualBrief(name, topTags)],
    });

    return await saveGeneratedThemeImageBytes(image.bytes, slug);
  } catch (error) {
    log.warn({ error, name }, "Theme image generation failed; tile falls back to a recipe photo");

    return null;
  }
}

/**
 * The first candidate name not already used, so no two theme tiles share a
 * label. Priority: the AI name, then the cluster's top tags, then the nearest
 * recipe titles. When every candidate collides (e.g. AI naming is down and two
 * clusters share a dominant tag), the best one is disambiguated with a secondary
 * tag ("jednoduché · cestoviny"). Returns null only when there is nothing to
 * label the cluster with at all.
 */
function pickDistinctThemeName(
  aiName: string | null,
  topTags: string[],
  titles: string[],
  used: Set<string>
): string | null {
  const candidates = [aiName, ...topTags, ...titles].filter((value): value is string =>
    Boolean(value && value.trim())
  );

  const fresh = candidates.find((candidate) => !used.has(candidate.toLowerCase()));

  if (fresh) {
    return fresh;
  }

  const base = candidates[0];

  if (!base) {
    return null;
  }

  const extra = topTags.find((tag) => tag.toLowerCase() !== base.toLowerCase());
  const disambiguated = extra ? `${base} · ${extra}` : `${base} (${used.size + 1})`;

  return used.has(disambiguated.toLowerCase()) ? `${base} (${used.size + 1})` : disambiguated;
}
