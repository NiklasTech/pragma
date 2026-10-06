import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useReviewCommentsStore } from "./comments";

const base = { path: "a.ts", side: "new" as const, line: 1, code: "x", body: "Fix" };

describe("useReviewCommentsStore", () => {
  beforeEach(() => useReviewCommentsStore.setState({ comments: [] }));

  it("adds, edits, removes and clears comments per session", () => {
    const store = useReviewCommentsStore.getState();
    store.addComment({ ...base, sessionId: "s1" });
    store.addComment({ ...base, sessionId: "s1", line: 2 });
    store.addComment({ ...base, sessionId: "s2" });

    const ids = useReviewCommentsStore.getState().comments.map((comment) => comment.id);
    store.updateComment(ids[0] ?? "", "Edited");
    store.removeComment(ids[1] ?? "");
    expect(useReviewCommentsStore.getState().comments.map((c) => [c.sessionId, c.body])).toEqual([
      ["s1", "Edited"],
      ["s2", "Fix"],
    ]);

    store.clearSession("s1");
    expect(useReviewCommentsStore.getState().comments.map((c) => c.sessionId)).toEqual(["s2"]);
  });
});
