import { breadcrumbListLd, recipeItemListLd } from "@/lib/structured-data";
import { describe, expect, it } from "vitest";

describe("structured-data builders", () => {
  it("builds a positioned BreadcrumbList", () => {
    const ld = breadcrumbListLd([
      { name: "Objavuj", url: "https://x.sk/discover" },
      { name: "Obed", url: "https://x.sk/discover/category/lunch" },
    ]) as Record<string, unknown>;

    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Objavuj", item: "https://x.sk/discover" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Obed",
        item: "https://x.sk/discover/category/lunch",
      },
    ]);
  });

  it("builds an ItemList of recipe URLs with a count", () => {
    const ld = recipeItemListLd({
      name: "Obedy",
      url: "https://x.sk/discover/category/lunch",
      recipeUrls: ["https://x.sk/r/a", "https://x.sk/r/b"],
    }) as Record<string, unknown>;

    expect(ld["@type"]).toBe("ItemList");
    expect(ld.numberOfItems).toBe(2);
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, url: "https://x.sk/r/a" },
      { "@type": "ListItem", position: 2, url: "https://x.sk/r/b" },
    ]);
  });
});
