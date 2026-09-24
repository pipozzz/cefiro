// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EmbeddedRecipe } from "../../../src/ai/themes/cluster";
import {
  clusterEmbeddings,
  nearestMembers,
  representativeOf,
} from "../../../src/ai/themes/cluster";

/** Two well-separated blobs in 4-D: axis 0 and axis 1, with a little jitter. */
function twoBlobs(): EmbeddedRecipe[] {
  const items: EmbeddedRecipe[] = [];

  for (let i = 0; i < 8; i += 1) {
    items.push({ recipeId: `a${i}`, embedding: [1, 0.05 * i, 0, 0] });
    items.push({ recipeId: `b${i}`, embedding: [0, 0, 1, 0.05 * i] });
  }

  return items;
}

describe("clusterEmbeddings", () => {
  it("separates two blobs into two clusters", () => {
    const clusters = clusterEmbeddings(twoBlobs(), { minK: 2, maxK: 2, minClusterSize: 1 });

    expect(clusters).toHaveLength(2);

    const groups = clusters.map((cluster) =>
      cluster.memberIds.every((id) => id.startsWith("a")) ? "a" : "b"
    );

    // Each cluster is pure (all a's or all b's) and both groups are represented.
    expect(new Set(groups)).toEqual(new Set(["a", "b"]));
    for (const cluster of clusters) {
      const prefixes = new Set(cluster.memberIds.map((id) => id[0]));

      expect(prefixes.size).toBe(1);
    }
  });

  it("returns no clusters below the minimum item count", () => {
    const few = twoBlobs().slice(0, 3);

    expect(clusterEmbeddings(few, { minItems: 12 })).toEqual([]);
  });

  it("drops clusters smaller than the minimum size", () => {
    const items = twoBlobs();

    // One lone outlier on a third axis: with k=3 it forms a size-1 cluster,
    // which must be dropped when minClusterSize is 2.
    items.push({ recipeId: "outlier", embedding: [0, 0, 0, 1] });

    const clusters = clusterEmbeddings(items, { minK: 3, maxK: 3, minClusterSize: 2 });

    expect(clusters.every((cluster) => cluster.memberIds.length >= 2)).toBe(true);
    expect(clusters.some((cluster) => cluster.memberIds.includes("outlier"))).toBe(false);
  });

  it("is deterministic for a given seed", () => {
    const a = clusterEmbeddings(twoBlobs(), { minK: 2, maxK: 2, minClusterSize: 1, seed: 42 });
    const b = clusterEmbeddings(twoBlobs(), { minK: 2, maxK: 2, minClusterSize: 1, seed: 42 });

    expect(a.map((c) => c.memberIds)).toEqual(b.map((c) => c.memberIds));
  });

  it("returns unit-length centroids (valid cosine query vectors)", () => {
    const [cluster] = clusterEmbeddings(twoBlobs(), { minK: 2, maxK: 2, minClusterSize: 1 });
    const length = Math.sqrt(cluster!.centroid.reduce((sum, v) => sum + v * v, 0));

    expect(length).toBeCloseTo(1, 5);
  });

  it("orders clusters largest first", () => {
    const items = twoBlobs();

    for (let i = 0; i < 4; i += 1)
      items.push({ recipeId: `a${i + 8}`, embedding: [1, 0.05 * i, 0, 0] });

    const clusters = clusterEmbeddings(items, { minK: 2, maxK: 2, minClusterSize: 1 });

    expect(clusters[0]!.memberIds.length).toBeGreaterThanOrEqual(clusters[1]!.memberIds.length);
  });
});

describe("representativeOf / nearestMembers", () => {
  it("picks the member nearest the centroid", () => {
    const embeddingById = new Map<string, number[]>([
      ["near", [1, 0, 0, 0]],
      ["mid", [0.7, 0.7, 0, 0]],
      ["far", [0, 1, 0, 0]],
    ]);
    const cluster = { memberIds: ["far", "mid", "near"], centroid: [1, 0, 0, 0] };

    expect(representativeOf(cluster, embeddingById)).toBe("near");
    expect(nearestMembers(cluster, embeddingById, 2)).toEqual(["near", "mid"]);
  });
});
