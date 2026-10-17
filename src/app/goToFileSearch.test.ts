import { describe, expect, it } from "vite-plus/test";

import { rankFiles, scoreFile, toGoToFileEntry } from "./goToFileSearch";

const files = [
  "README.md",
  "src/app/GoToFile.tsx",
  "src/app/goToFileSearch.ts",
  "src/features/editor/components/FileEditor.tsx",
  "src/shared/stores/goToFile.ts",
  "docs-site/getting-started.md",
].map((path) => toGoToFileEntry("/repo/", path));

function names(query: string, limit = 10): string[] {
  return rankFiles(files, query, limit).map((file) => file.relativePath);
}

describe("toGoToFileEntry", () => {
  it("joins the root and keeps lowercase keys", () => {
    expect(toGoToFileEntry("/repo/", "src/App.tsx")).toEqual({
      path: "/repo/src/App.tsx",
      name: "App.tsx",
      relativePath: "src/App.tsx",
      nameKey: "app.tsx",
      pathKey: "src/app.tsx",
    });
  });
});

describe("rankFiles", () => {
  it("keeps the listing order for an empty query and applies the limit", () => {
    expect(names("", 2)).toEqual(["README.md", "src/app/GoToFile.tsx"]);
  });

  it("ranks an exact name before a name prefix and an abbreviation", () => {
    expect(names("gotofile.ts")).toEqual([
      "src/shared/stores/goToFile.ts",
      "src/app/GoToFile.tsx",
      "src/app/goToFileSearch.ts",
    ]);
  });

  it("matches the path and abbreviations, ignoring case and spaces", () => {
    expect(names("features/editor")).toEqual(["src/features/editor/components/FileEditor.tsx"]);
    expect(names("FE tsx")[0]).toBe("src/features/editor/components/FileEditor.tsx");
    expect(names("gs")).toContain("docs-site/getting-started.md");
  });

  it("returns nothing when no file matches", () => {
    expect(names("zzz")).toEqual([]);
  });
});

describe("scoreFile", () => {
  it("prefers name matches over path-only matches", () => {
    const [readme] = files;
    const nameScore = scoreFile(readme, "readme");
    const pathScore = scoreFile(files[3], "components");
    expect(nameScore).not.toBeNull();
    expect(pathScore).not.toBeNull();
    expect(nameScore ?? 0).toBeGreaterThan(pathScore ?? 0);
  });
});
