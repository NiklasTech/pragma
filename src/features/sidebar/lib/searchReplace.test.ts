import { describe, expect, it } from "vite-plus/test";
import {
  buildReplaceRegExp,
  isPathInsideRoot,
  isSameFilePath,
  replaceAllInContent,
  replaceOneMatchInContent,
} from "./searchReplace";

const literalOptions = {
  query: "foo",
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
};

describe("buildReplaceRegExp", () => {
  it("escapes literal queries", () => {
    const regExp = buildReplaceRegExp({ ...literalOptions, query: "a.b" });
    expect("a.b aXb".match(regExp)).toEqual(["a.b"]);
  });

  it("adds whole word boundaries", () => {
    const regExp = buildReplaceRegExp({ ...literalOptions, wholeWord: true });
    expect("foo foobar".match(regExp)).toEqual(["foo"]);
  });

  it("keeps regex queries unescaped", () => {
    const regExp = buildReplaceRegExp({ ...literalOptions, query: "\\d+", useRegex: true });
    expect("a1 b22".match(regExp)).toEqual(["1", "22"]);
  });
});

describe("replaceAllInContent", () => {
  it("replaces every occurrence and counts them", () => {
    const result = replaceAllInContent("foo bar foo\nfoo", literalOptions, "baz");
    expect(result.replacementCount).toBe(3);
    expect(result.content).toBe("baz bar baz\nbaz");
  });

  it("respects case sensitivity", () => {
    const result = replaceAllInContent(
      "Foo foo",
      { ...literalOptions, caseSensitive: true },
      "baz",
    );
    expect(result.replacementCount).toBe(1);
    expect(result.content).toBe("Foo baz");
  });

  it("replaces nothing when there are no matches", () => {
    const result = replaceAllInContent("nothing here", literalOptions, "baz");
    expect(result.replacementCount).toBe(0);
    expect(result.content).toBe("nothing here");
  });

  it("supports regex queries", () => {
    const result = replaceAllInContent(
      "item 1, item 22",
      { ...literalOptions, query: "\\d+", useRegex: true },
      "N",
    );
    expect(result.replacementCount).toBe(2);
    expect(result.content).toBe("item N, item N");
  });
});

describe("replaceOneMatchInContent", () => {
  it("replaces the match at the given line and byte column", () => {
    const result = replaceOneMatchInContent(
      "foo bar foo\nfoo",
      literalOptions,
      { line: 1, column: 9 },
      "baz",
    );
    expect(result.replaced).toBe(true);
    expect(result.content).toBe("foo bar baz\nfoo");
  });

  it("uses byte columns so multibyte characters stay aligned", () => {
    const result = replaceOneMatchInContent(
      "h\u00e9llo foo",
      literalOptions,
      { line: 1, column: 8 },
      "baz",
    );
    expect(result.replaced).toBe(true);
    expect(result.content).toBe("h\u00e9llo baz");
  });

  it("does not replace when the column does not start a match", () => {
    const result = replaceOneMatchInContent(
      "foo foo",
      literalOptions,
      { line: 1, column: 2 },
      "baz",
    );
    expect(result.replaced).toBe(false);
    expect(result.content).toBe("foo foo");
  });

  it("does not replace when the line is out of range", () => {
    const result = replaceOneMatchInContent("foo", literalOptions, { line: 2, column: 1 }, "baz");
    expect(result.replaced).toBe(false);
    expect(result.content).toBe("foo");
  });
});

describe("path helpers", () => {
  it("compares paths ignoring separators and casing", () => {
    expect(isSameFilePath("C:\\Work\\Foo.ts", "c:/work/foo.ts")).toBe(true);
    expect(isSameFilePath("C:\\Work\\Foo.ts", "C:\\Work\\Bar.ts")).toBe(false);
  });

  it("detects paths inside a root", () => {
    expect(isPathInsideRoot("C:\\Work\\src\\a.ts", "C:\\Work")).toBe(true);
    expect(isPathInsideRoot("C:\\Work\\src\\a.ts", "C:\\Work\\src")).toBe(true);
    expect(isPathInsideRoot("C:\\Work2\\a.ts", "C:\\Work")).toBe(false);
    expect(isPathInsideRoot("C:\\Work\\a.ts", "C:\\Work\\a.ts")).toBe(true);
  });
});
