import { describe, expect, it } from "vite-plus/test";

import { insertAtCursor } from "./insertAtCursor";

describe("insertAtCursor", () => {
  it("inserts into an empty value", () => {
    expect(insertAtCursor("", "hello", 0)).toEqual({ value: "hello", cursor: 5 });
  });

  it("spaces the insert off the preceding word", () => {
    expect(insertAtCursor("hello", "world", 5)).toEqual({ value: "hello world", cursor: 11 });
  });

  it("does not double the space after a trailing space", () => {
    expect(insertAtCursor("hello ", "world", 6)).toEqual({ value: "hello world", cursor: 11 });
  });

  it("spaces before an existing word", () => {
    expect(insertAtCursor("world", "hello", 0)).toEqual({ value: "hello world", cursor: 5 });
  });

  it("inserts between two words", () => {
    expect(insertAtCursor("hello world", "brave", 6)).toEqual({
      value: "hello brave world",
      cursor: 11,
    });
  });

  it("ignores empty transcripts", () => {
    const value = "hello";
    expect(insertAtCursor(value, "   ", 5)).toEqual({ value, cursor: 5 });
  });

  it("clamps the cursor to the value length", () => {
    expect(insertAtCursor("a", "b", 99)).toEqual({ value: "a b", cursor: 3 });
  });

  it("trims transcript whitespace", () => {
    expect(insertAtCursor("hello", " world ", 5)).toEqual({ value: "hello world", cursor: 11 });
  });
});
