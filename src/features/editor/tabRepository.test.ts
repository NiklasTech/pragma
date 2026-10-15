import { describe, expect, it } from "vite-plus/test";

import { otherTabRepository } from "./tabRepository";

const repositories = ["/code/a", "/code/b", "/code/b/packages/c"];

describe("otherTabRepository", () => {
  it("names the repository of a tab outside the active one", () => {
    expect(otherTabRepository("/code/b/src/main.ts", repositories, "/code/a")).toBe("/code/b");
  });

  it("returns null for tabs of the active repository and for files outside every repository", () => {
    expect(otherTabRepository("/code/a/src/main.ts", repositories, "/code/a")).toBeNull();
    expect(otherTabRepository("/tmp/notes.md", repositories, "/code/a")).toBeNull();
  });

  it("picks the innermost repository", () => {
    expect(otherTabRepository("/code/b/packages/c/index.ts", repositories, "/code/b")).toBe(
      "/code/b/packages/c",
    );
  });
});
