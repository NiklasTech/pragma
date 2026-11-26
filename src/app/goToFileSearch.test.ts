import { describe, expect, it } from "vite-plus/test";

import { toGoToFileEntry } from "./goToFileSearch";

describe("toGoToFileEntry", () => {
  it("joins the root and the relative path", () => {
    expect(toGoToFileEntry("/repo/", "src/App.tsx")).toEqual({
      path: "/repo/src/App.tsx",
      name: "App.tsx",
      relativePath: "src/App.tsx",
    });
  });
});
