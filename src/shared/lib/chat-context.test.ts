import { describe, expect, it } from "vite-plus/test";

import { buildContextUserMessage, parseMentions, stripMentions } from "./chat-context";

describe("parseMentions", () => {
  it("returns an empty array when no mentions are present", () => {
    expect(parseMentions("Hello world")).toEqual([]);
  });

  it("extracts a single mention", () => {
    expect(parseMentions("@src/main.ts explain this")).toEqual(["src/main.ts"]);
  });

  it("extracts multiple mentions and removes duplicates", () => {
    const input = "@src/main.ts @src/lib/utils.ts explain @src/main.ts";
    expect(parseMentions(input)).toEqual(["src/main.ts", "src/lib/utils.ts"]);
  });
});

describe("stripMentions", () => {
  it("removes mentions and normalizes whitespace", () => {
    expect(stripMentions("@src/main.ts explain this")).toBe("explain this");
  });

  it("handles multiple mentions", () => {
    expect(stripMentions("@a @b what about this?")).toBe("what about this?");
  });
});

describe("buildContextUserMessage", () => {
  it("combines context content with a question", () => {
    const context = "Context header\n--- file ---\ncontent";
    const question = "explain this";
    expect(buildContextUserMessage(context, question)).toBe(
      "Context header\n--- file ---\ncontent\n\nexplain this",
    );
  });

  it("returns only context content when the question is empty", () => {
    expect(buildContextUserMessage("context", "")).toBe("context");
  });
});
