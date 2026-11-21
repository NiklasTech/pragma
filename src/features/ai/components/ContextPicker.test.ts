import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { MAX_FILE_RESULTS, matchingFiles, type DirEntry } from "./ContextPicker";

function file(rel: string): DirEntry {
  return {
    path: `/repo/${rel}`,
    name: rel.split("/").pop() ?? rel,
    is_directory: false,
    is_file: true,
  };
}

describe("matchingFiles", () => {
  const entries = Array.from({ length: 10_000 }, (_, index) => file(`pkg${index}/file.ts`));

  it("shows only the first files of a large project for an empty query", () => {
    expect(matchingFiles(entries, "", "/repo")).toHaveLength(MAX_FILE_RESULTS);
  });

  it("matches the path relative to the project", () => {
    expect(matchingFiles(entries, "pkg9999/", "/repo").map((entry) => entry.path)).toEqual([
      "/repo/pkg9999/file.ts",
    ]);
    expect(matchingFiles(entries, "repo/", "/repo")).toEqual([]);
  });
});
