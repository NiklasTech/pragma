import { describe, expect, it } from "vite-plus/test";
import type { GhPullRequest } from "@/shared/stores/github";
import { TASK_NOTES_MAX } from "@/features/ai/tasks/validation";
import { buildReviewTaskNotes } from "./reviewTask";

const pr: GhPullRequest = {
  number: 12,
  title: "feat: x",
  url: "https://github.com/o/r/pull/12",
  state: "OPEN",
  is_draft: false,
  base_ref: "main",
  checks: { total: 0, passing: 0, failing: 0, pending: 0 },
};

describe("buildReviewTaskNotes", () => {
  it("lists review summaries and inline comments with their location", () => {
    const notes = buildReviewTaskNotes(pr, [
      {
        author: "alice",
        body: "Please split this.",
        path: null,
        line: null,
        state: "CHANGES_REQUESTED",
      },
      { author: "bob", body: " Rename this. ", path: "src/a.ts", line: 42, state: null },
      { author: "carol", body: "Outdated.", path: "src/b.ts", line: null, state: null },
    ]);

    expect(notes).toBe(
      [
        "Address the review comments on pull request #12 (https://github.com/o/r/pull/12).",
        "Review by alice, changes requested:\nPlease split this.",
        "src/a.ts:42 (bob):\nRename this.",
        "src/b.ts (carol):\nOutdated.",
      ].join("\n\n"),
    );
  });

  it("truncates to the task notes limit", () => {
    const notes = buildReviewTaskNotes(pr, [
      { author: "a", body: "x".repeat(TASK_NOTES_MAX), path: null, line: null, state: null },
    ]);

    expect(notes.length).toBe(TASK_NOTES_MAX);
    expect(notes.endsWith("remaining comments.]")).toBe(true);
  });
});
