import { describe, expect, it } from "vite-plus/test";
import { MAX_DIFF_CHARS, cleanCommitMessage, truncateDiff } from "./commitMessage";

describe("cleanCommitMessage", () => {
  it("keeps a plain message", () => {
    expect(cleanCommitMessage("  feat: add amend toggle\n")).toBe("feat: add amend toggle");
  });

  it("removes reasoning and a surrounding code fence", () => {
    const reply =
      "<think>looking at the diff</think>\n```text\nfix(git): keep changes staged\n\nBody\n```";
    expect(cleanCommitMessage(reply)).toBe("fix(git): keep changes staged\n\nBody");
  });
});

describe("truncateDiff", () => {
  it("leaves short diffs alone", () => {
    expect(truncateDiff("diff")).toBe("diff");
  });

  it("cuts long diffs and marks them", () => {
    const result = truncateDiff("a".repeat(MAX_DIFF_CHARS + 10));
    expect(result.startsWith("a".repeat(MAX_DIFF_CHARS))).toBe(true);
    expect(result.endsWith("[diff truncated]")).toBe(true);
  });
});
