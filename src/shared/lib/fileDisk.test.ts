import { describe, expect, it } from "vite-plus/test";
import {
  isChangedOnDiskError,
  isMissingFileError,
  isSameOrInside,
  parentPath,
  sha256Hex,
} from "./fileDisk";

describe("sha256Hex", () => {
  it("hashes the UTF-8 bytes like the Rust side", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex("content")).toBe(
      "ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73",
    );
  });
});

describe("error matching", () => {
  it("recognizes the backend conflict and missing-file errors", () => {
    expect(isChangedOnDiskError("File changed on disk since it was loaded")).toBe(true);
    expect(isChangedOnDiskError("Failed to write file: denied")).toBe(false);
    expect(isMissingFileError("File not found: /a.ts")).toBe(true);
    expect(isMissingFileError("Not a file: /a")).toBe(true);
    expect(isMissingFileError("Binary files are not supported")).toBe(false);
  });
});

describe("path helpers", () => {
  it("matches a path and its descendants only", () => {
    expect(isSameOrInside("/w/src/a.ts", "/w/src")).toBe(true);
    expect(isSameOrInside("/w/src", "/w/src")).toBe(true);
    expect(isSameOrInside("/w/src-old/a.ts", "/w/src")).toBe(false);
    expect(isSameOrInside("C:\\w\\src\\a.ts", "C:\\w\\src")).toBe(true);
  });

  it("returns the parent for both separators", () => {
    expect(parentPath("/w/src/a.ts")).toBe("/w/src");
    expect(parentPath("C:\\w\\a.ts")).toBe("C:\\w");
  });
});
