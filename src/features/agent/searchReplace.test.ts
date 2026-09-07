import { describe, expect, it } from "vite-plus/test";

import { applySearchReplace } from "./searchReplace";

describe("applySearchReplace", () => {
  it("replaces a unique match", () => {
    const result = applySearchReplace("const a = 1;", "1", "2", false);
    expect(result.content).toBe("const a = 2;");
  });

  it("replaces all matches when replaceAll is true", () => {
    const result = applySearchReplace("foo foo foo", "foo", "bar", true);
    expect(result.content).toBe("bar bar bar");
  });

  it("throws when the string is missing", () => {
    expect(() => applySearchReplace("hello", "world", "x", false)).toThrow(
      "old_string not found in file",
    );
  });

  it("throws when a non-unique match is not replaceAll", () => {
    expect(() => applySearchReplace("foo foo", "foo", "bar", false)).toThrow(
      "matches multiple locations",
    );
  });

  it("throws on an empty old_string", () => {
    expect(() => applySearchReplace("hello", "", "x", false)).toThrow(
      "old_string must not be empty",
    );
    expect(() => applySearchReplace("hello", "", "x", true)).toThrow(
      "old_string must not be empty",
    );
  });
});
