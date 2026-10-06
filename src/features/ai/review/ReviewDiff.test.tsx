import { describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/features/editor/components/InlineDiff", () => ({
  InlineDiff: () => <div data-testid="inline-diff" />,
}));

import { ReviewDiff } from "./ReviewDiff";

const data = { original: "before", modified: "after", patchText: "" };

describe("ReviewDiff", () => {
  it("labels a worktree diff with the branch and hides both actions", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff
        sessionId="s"
        path="src/a.ts"
        data={data}
        mode="worktree"
        branch="pragma/session-1"
      />,
    );

    expect(html).toContain("Written in pragma/session-1");
    expect(html).not.toContain("Accept");
    expect(html).not.toContain("Reject");
  });

  it("offers Reject but not Accept for a checkout file", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff sessionId="s" path="src/a.ts" data={data} mode="checkout" onReject={() => {}} />,
    );

    expect(html).toContain("Reject");
    expect(html).not.toContain("Accept");
  });

  it("offers Accept and Reject for a pending edit", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff
        sessionId="s"
        path="src/a.ts"
        data={data}
        mode="pending"
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );

    expect(html).toContain("Accept");
    expect(html).toContain("Reject");
  });
});

describe("ReviewDiff hunks", () => {
  const patch = "@@ -1,1 +1,1 @@\n-before\n+after";

  it("shows the hunk diff with keep and discard actions for a written file", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff
        sessionId="s"
        path="src/a.ts"
        data={{ ...data, patchText: patch }}
        mode="checkout"
        hunkActions={{ busy: false, onApply: () => {} }}
      />,
    );

    expect(html).not.toContain("inline-diff");
    expect(html).toContain("Keep");
    expect(html).toContain("Discard");
    expect(html).toContain("Comment on this line");
  });

  it("shows a new file as one added hunk without hunk actions", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff
        sessionId="s"
        path="src/new.ts"
        data={{ original: "", modified: "line\n", patchText: "" }}
        mode="worktree"
        branch="pragma/s"
      />,
    );

    expect(html).toContain("@@ -0,0 +1,1 @@");
    expect(html).not.toContain("Keep");
  });

  it("marks a fully kept file", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff
        sessionId="s"
        path="src/a.ts"
        data={{ ...data, patchText: patch }}
        mode="checkout"
        kept
      />,
    );

    expect(html).toContain("Kept");
  });
});
