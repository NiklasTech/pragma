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
      <ReviewDiff path="src/a.ts" data={data} mode="worktree" branch="pragma/session-1" />,
    );

    expect(html).toContain("Written in pragma/session-1");
    expect(html).not.toContain("Accept");
    expect(html).not.toContain("Reject");
  });

  it("offers Reject but not Accept for a checkout file", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff path="src/a.ts" data={data} mode="checkout" onReject={() => {}} />,
    );

    expect(html).toContain("Reject");
    expect(html).not.toContain("Accept");
  });

  it("offers Accept and Reject for a pending edit", () => {
    const html = renderToStaticMarkup(
      <ReviewDiff
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
