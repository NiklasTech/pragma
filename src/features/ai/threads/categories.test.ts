import { describe, expect, it } from "vite-plus/test";

import { buildThreadSections, listCategories, normalizeCategory } from "./categories";

const NOW = new Date(2026, 8, 27, 15, 0, 0).getTime();

function thread(id: string, updatedAt: number, category?: string) {
  return category ? { id, updatedAt, category } : { id, updatedAt };
}

describe("normalizeCategory", () => {
  it("trims, collapses whitespace and rejects empty names", () => {
    expect(normalizeCategory("  Bug   fixes ")).toBe("Bug fixes");
    expect(normalizeCategory("   ")).toBeNull();
    expect(normalizeCategory("x".repeat(60))).toHaveLength(40);
  });
});

describe("listCategories", () => {
  it("returns unique names in alphabetical order", () => {
    expect(
      listCategories([
        thread("a", 1, "Research"),
        thread("b", 2),
        thread("c", 3, "Bugs"),
        thread("d", 4, "Research"),
      ]),
    ).toEqual(["Bugs", "Research"]);
  });
});

describe("buildThreadSections", () => {
  it("puts categories first and buckets the rest by recency", () => {
    const sections = buildThreadSections(
      [thread("a", NOW, "Research"), thread("b", NOW), thread("c", NOW - 1, "Bugs")],
      () => false,
      NOW,
    );

    expect(sections.map((section) => section.key)).toEqual([
      "category:Bugs",
      "category:Research",
      "recent:Today",
    ]);
    expect(sections.map((section) => section.items.map((item) => item.id))).toEqual([
      ["c"],
      ["a"],
      ["b"],
    ]);
  });

  it("keeps category keys distinct from recency labels", () => {
    const sections = buildThreadSections(
      [thread("a", NOW, "Today"), thread("b", NOW)],
      () => false,
      NOW,
    );
    expect(sections.map((section) => section.key)).toEqual(["category:Today", "recent:Today"]);
  });
});
