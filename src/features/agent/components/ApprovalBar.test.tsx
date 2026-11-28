import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolDiffList } from "@/features/ai/components/ToolDiff";

import { ApprovalBar } from "./ApprovalBar";

const noop = () => {};

describe("ApprovalBar", () => {
  it("shows what an edit would change before it is allowed", () => {
    const html = renderToStaticMarkup(
      <ApprovalBar
        title="Claude Code asks for permission"
        request="Edit notes.txt"
        onDeny={noop}
        onAllow={noop}
        details={
          <ToolDiffList
            diffs={[{ path: "/repo/notes.txt", oldText: "beta\n", newText: "BETA\n" }]}
            root="/repo"
          />
        }
      />,
    );
    expect(html).toContain("Edit notes.txt");
    expect(html).toContain("notes.txt");
    expect(html).toContain("- beta");
    expect(html).toContain("+ BETA");
  });

  it("stays one line without details", () => {
    const html = renderToStaticMarkup(
      <ApprovalBar title="Asks" request="ls" onDeny={noop} onAllow={noop} />,
    );
    expect(html).not.toContain("overflow-y-auto");
  });
});
