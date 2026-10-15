import { describe, expect, it } from "vite-plus/test";

import { chooseRepository } from "./repositoryChoice";

const PATHS = ["/code/pragma", "/code/test-repo", "/code/docs"];

describe("chooseRepository", () => {
  it("defaults to the active repository", () => {
    expect(chooseRepository(PATHS, "/code/test-repo")).toBe("/code/test-repo");
    expect(chooseRepository(PATHS, "/code/test-repo", null)).toBe("/code/test-repo");
  });

  it("uses the picked repository while it is open", () => {
    expect(chooseRepository(PATHS, "/code/pragma", "/code/docs")).toBe("/code/docs");
  });

  it("matches the picked path regardless of a trailing separator", () => {
    expect(chooseRepository(PATHS, "/code/pragma", "/code/docs/")).toBe("/code/docs");
  });

  it("falls back to the active repository once the picked one is closed", () => {
    expect(chooseRepository(PATHS, "/code/pragma", "/code/closed")).toBe("/code/pragma");
  });

  it("returns null without an active or picked repository", () => {
    expect(chooseRepository([], null)).toBeNull();
  });
});
