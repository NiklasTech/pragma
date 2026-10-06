import { describe, expect, it } from "vite-plus/test";

import type { ReviewComment } from "./comments";
import { buildReviewMessage, commentLocation } from "./reviewMessage";

function comment(patch: Partial<ReviewComment>): ReviewComment {
  return {
    id: "c",
    sessionId: "s",
    path: "src/a.ts",
    side: "new",
    line: 1,
    code: "const a = 1;",
    body: "Rename this.",
    ...patch,
  };
}

describe("commentLocation", () => {
  it("names the file and line and marks removed lines", () => {
    expect(commentLocation(comment({ line: 12 }))).toBe("src/a.ts:12");
    expect(commentLocation(comment({ line: 4, side: "old" }))).toBe("src/a.ts:4 (removed line)");
  });
});

describe("buildReviewMessage", () => {
  it("lists every comment with its location, quoted code and body, sorted by file and line", () => {
    const message = buildReviewMessage([
      comment({ path: "src/b.ts", line: 3, code: "b()", body: "Why?" }),
      comment({ line: 9, code: "late()", body: "  Remove.  " }),
      comment({ line: 2, code: "early()", body: "Keep." }),
    ]);

    expect(message).toBe(
      [
        "Please address these review comments on your changes:",
        "1. src/a.ts:2\n```\nearly()\n```\nKeep.",
        "2. src/a.ts:9\n```\nlate()\n```\nRemove.",
        "3. src/b.ts:3\n```\nb()\n```\nWhy?",
      ].join("\n\n"),
    );
  });

  it("uses a longer fence when the quoted code contains backticks", () => {
    const message = buildReviewMessage([comment({ code: "const s = ```x```;" })]);

    expect(message).toContain("````\nconst s = ```x```;\n````");
  });
});
