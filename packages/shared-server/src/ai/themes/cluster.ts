/**
 * Spherical k-means over recipe embeddings (Phase B2).
 *
 * The embeddings are compared by cosine similarity, so vectors are L2-normalised
 * up front and similarity becomes a dot product. Centroids are the normalised
 * mean of their members — the same space the members live in, so a centroid is
 * itself a valid query vector for the Phase B3 similarity search.
 *
 * Deterministic: a seeded RNG drives k-means++ initialisation, so the same
 * corpus yields the same clusters run to run (a weekly rebuild does not reshuffle
 * discovery for no reason). Pure and synchronous — no AI, no I/O.
 */

export interface EmbeddedRecipe {
  recipeId: string;
  embedding: number[];
}

export interface RecipeCluster {
  /** Member recipe ids, largest clusters returned first. */
  memberIds: string[];
  /** Normalised mean of the members — a query vector for similarity search. */
  centroid: number[];
}

export interface ClusterOptions {
  /** Below this many recipes there is nothing worth clustering. Default 12. */
  minItems?: number;
  /** Fewest clusters to form. Default 4. */
  minK?: number;
  /** Most clusters to form. Default 12. */
  maxK?: number;
  /** Clusters smaller than this are dropped as noise. Default 3. */
  minClusterSize?: number;
  /** Lloyd iterations. Default 20. */
  iterations?: number;
  /** RNG seed, for deterministic runs. Default 1. */
  seed?: number;
}

/** Small, fast, deterministic PRNG (mulberry32) → [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalise(vector: number[]): number[] {
  let sumSquares = 0;

  for (const value of vector) sumSquares += value * value;

  const length = Math.sqrt(sumSquares);

  if (length === 0) return vector.slice();

  return vector.map((value) => value / length);
}

function dot(a: number[], b: number[]): number {
  let sum = 0;

  for (let i = 0; i < a.length; i += 1) sum += a[i]! * b[i]!;

  return sum;
}

/** Mean of the given unit vectors, renormalised back onto the unit sphere. */
function meanCentroid(vectors: number[][], dimensions: number): number[] {
  const mean = new Array<number>(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i += 1) mean[i]! += vector[i]!;
  }

  for (let i = 0; i < dimensions; i += 1) mean[i]! /= vectors.length;

  return normalise(mean);
}

function chooseK(n: number, minK: number, maxK: number): number {
  const target = Math.round(Math.sqrt(n / 2));

  return Math.max(minK, Math.min(maxK, Math.min(target, n)));
}

/** k-means++ seeding: spread the initial centroids by squared cosine distance. */
function seedCentroids(points: number[][], k: number, random: () => number): number[][] {
  const centroids: number[][] = [points[Math.floor(random() * points.length)]!];

  while (centroids.length < k) {
    const distances = points.map((point) => {
      let best = -1;

      for (const centroid of centroids) best = Math.max(best, dot(point, centroid));

      // Cosine distance in [0, 2]; squared so far points dominate the draw.
      const distance = 1 - best;

      return distance * distance;
    });

    const total = distances.reduce((sum, d) => sum + d, 0);

    if (total === 0) {
      // Every remaining point coincides with a centroid; pad arbitrarily.
      centroids.push(points[centroids.length % points.length]!);
      continue;
    }

    let threshold = random() * total;
    let index = 0;

    while (index < distances.length - 1 && threshold > distances[index]!) {
      threshold -= distances[index]!;
      index += 1;
    }

    centroids.push(points[index]!);
  }

  return centroids.map((centroid) => centroid.slice());
}

export function clusterEmbeddings(
  items: readonly EmbeddedRecipe[],
  options: ClusterOptions = {}
): RecipeCluster[] {
  const {
    minItems = 12,
    minK = 4,
    maxK = 12,
    minClusterSize = 3,
    iterations = 20,
    seed = 1,
  } = options;

  if (items.length < minItems) return [];

  const dimensions = items[0]!.embedding.length;
  const points = items.map((item) => normalise(item.embedding));
  const k = chooseK(items.length, minK, maxK);
  const random = mulberry32(seed);

  let centroids = seedCentroids(points, k, random);
  const assignments = new Array<number>(points.length).fill(0);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let moved = false;

    for (let p = 0; p < points.length; p += 1) {
      let bestCluster = 0;
      let bestScore = -Infinity;

      for (let c = 0; c < centroids.length; c += 1) {
        const score = dot(points[p]!, centroids[c]!);

        if (score > bestScore) {
          bestScore = score;
          bestCluster = c;
        }
      }

      if (assignments[p] !== bestCluster) {
        assignments[p] = bestCluster;
        moved = true;
      }
    }

    // Recompute centroids; re-seed any that emptied so k stays honest.
    centroids = centroids.map((centroid, c) => {
      const members = points.filter((_, p) => assignments[p] === c);

      if (members.length === 0) return points[Math.floor(random() * points.length)]!.slice();

      return meanCentroid(members, dimensions);
    });

    if (!moved && iteration > 0) break;
  }

  const buckets: string[][] = centroids.map(() => []);

  for (let p = 0; p < points.length; p += 1) buckets[assignments[p]!]!.push(items[p]!.recipeId);

  const clusters: RecipeCluster[] = [];

  for (let c = 0; c < buckets.length; c += 1) {
    const memberIds = buckets[c]!;

    if (memberIds.length < minClusterSize) continue;

    clusters.push({ memberIds, centroid: centroids[c]! });
  }

  clusters.sort((a, b) => b.memberIds.length - a.memberIds.length);

  return clusters;
}

/**
 * Cluster members ordered by closeness to the centroid, nearest first, limited
 * to `count`. The nearest is the cluster's most representative recipe (its tile
 * image); the top few titles are what the namer reads.
 */
export function nearestMembers(
  cluster: RecipeCluster,
  embeddingById: Map<string, number[]>,
  count: number
): string[] {
  return cluster.memberIds
    .map((recipeId) => {
      const embedding = embeddingById.get(recipeId);
      const score = embedding ? dot(normalise(embedding), cluster.centroid) : -Infinity;

      return { recipeId, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.recipeId);
}

/**
 * The member nearest a cluster's centroid — the cluster's most representative
 * recipe, used to supply its tile image. Returns the recipe id, or null for an
 * empty member list.
 */
export function representativeOf(
  cluster: RecipeCluster,
  embeddingById: Map<string, number[]>
): string | null {
  return nearestMembers(cluster, embeddingById, 1)[0] ?? null;
}
