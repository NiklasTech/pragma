import { describe, expect, it } from "vite-plus/test";

import { sliceFileLines } from "./readSlice";

describe("sliceFileLines", () => {
  it("returns the whole file with no offset or limit", () => {
    const content = "one\ntwo\nthree";
    const slice = sliceFileLines(content);
    expect(slice.text).toBe(content);
    expect(slice.startLine).toBe(1);
    expect(slice.endLine).toBe(3);
    expect(slice.totalLines).toBe(3);
  });

  it("slices from an offset with a visible header", () => {
    const slice = sliceFileLines("one\ntwo\nthree", 2);
    expect(slice.text).toContain("[Read lines 2-3 of 3]");
    expect(slice.text).toContain("two\nthree");
    expect(slice.startLine).toBe(2);
    expect(slice.endLine).toBe(3);
  });

  it("slices to a limit with a visible header", () => {
    const slice = sliceFileLines("one\ntwo\nthree", undefined, 2);
    expect(slice.text).toContain("[Read lines 1-2 of 3]");
    expect(slice.text).toContain("one\ntwo");
    expect(slice.text).not.toContain("three");
  });

  it("applies offset and limit together", () => {
    const slice = sliceFileLines("one\ntwo\nthree\nfour", 2, 2);
    expect(slice.text).toContain("[Read lines 2-3 of 4]");
    expect(slice.text).toContain("two\nthree");
    expect(slice.text).not.toContain("four");
  });

  it("reports the range when the offset is past the end", () => {
    const slice = sliceFileLines("one\ntwo", 5);
    expect(slice.text).toContain("of 2");
    expect(slice.startLine).toBe(5);
    expect(slice.endLine).toBe(4);
  });

  it("treats a trailing newline as a line terminator, not an extra line", () => {
    const slice = sliceFileLines("one\ntwo\n");
    expect(slice.totalLines).toBe(2);
    expect(slice.endLine).toBe(2);
  });

  it("returns zero lines for empty content", () => {
    const slice = sliceFileLines("");
    expect(slice.text).toBe("");
    expect(slice.startLine).toBe(0);
    expect(slice.endLine).toBe(0);
    expect(slice.totalLines).toBe(0);
  });
});
