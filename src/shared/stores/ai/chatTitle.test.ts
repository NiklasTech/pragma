import { describe, expect, it } from "vite-plus/test";

import { fallbackChatTitle } from "./chatTitle";

describe("fallbackChatTitle", () => {
  it("keeps a short first line as it is", () => {
    expect(fallbackChatTitle("fix the login bug")).toBe("Fix the login bug");
  });

  it("shortens long messages to the first words", () => {
    expect(fallbackChatTitle("Which test runner does this project use? Check package.json.")).toBe(
      "Which test runner does this project…",
    );
  });

  it("uses the first non-empty line", () => {
    expect(fallbackChatTitle("\n\n  Refactor store\nmore details")).toBe("Refactor store");
  });

  it("returns an empty title for blank input", () => {
    expect(fallbackChatTitle("   ")).toBe("");
  });
});
