import { describe, expect, it } from "vite-plus/test";

import { treeGuides } from "./treeGuides";

describe("treeGuides", () => {
  it("draws ├ for rows with a sibling below and └ for the last one", () => {
    // src/ { lib/ { math.ts strings.ts } main.ts } README.md
    const guides = treeGuides([
      { depth: 0 },
      { depth: 1 },
      { depth: 2 },
      { depth: 2 },
      { depth: 1 },
      { depth: 0 },
    ]);
    expect(guides.map((guide) => guide.last)).toEqual([false, false, false, true, true, true]);
  });

  it("runs an ancestor's line on only while it has a sibling below", () => {
    const guides = treeGuides([
      { depth: 0 },
      { depth: 1 },
      { depth: 2 },
      { depth: 1 },
      { depth: 2 },
    ]);
    expect(guides[2]!.through).toEqual([true]);
    expect(guides[4]!.through).toEqual([false]);
  });

  it("returns nothing for an empty tree", () => {
    expect(treeGuides([])).toEqual([]);
  });
});
