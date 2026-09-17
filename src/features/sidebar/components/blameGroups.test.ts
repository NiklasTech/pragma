import { describe, expect, it } from "vite-plus/test";
import type { GitBlameLine } from "@/shared/stores/git";
import { blameGroupByLine, groupBlameLines } from "./blameGroups";

function line(partial: Partial<GitBlameLine> & { line: number; sha: string }): GitBlameLine {
  return {
    short_sha: partial.sha.slice(0, 7),
    author: "Ada",
    author_email: "ada@example.com",
    timestamp_secs: 1700000000,
    content: `line ${partial.line}`,
    ...partial,
  };
}

describe("groupBlameLines", () => {
  it("merges consecutive lines from the same commit", () => {
    const groups = groupBlameLines([
      line({ line: 1, sha: "aaaa" }),
      line({ line: 2, sha: "aaaa" }),
      line({ line: 3, sha: "bbbb", author: "Grace" }),
      line({ line: 4, sha: "aaaa" }),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ sha: "aaaa", startLine: 1, endLine: 2 });
    expect(groups[0].lines).toEqual(["line 1", "line 2"]);
    expect(groups[1]).toMatchObject({ sha: "bbbb", author: "Grace", startLine: 3, endLine: 3 });
    expect(groups[2]).toMatchObject({ sha: "aaaa", startLine: 4, endLine: 4 });
  });

  it("splits groups when the same commit is not contiguous", () => {
    const groups = groupBlameLines([
      line({ line: 1, sha: "aaaa" }),
      line({ line: 3, sha: "aaaa" }),
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("blameGroupByLine", () => {
  it("maps every line of a group to that group", () => {
    const groups = groupBlameLines([
      line({ line: 1, sha: "aaaa" }),
      line({ line: 2, sha: "aaaa" }),
    ]);
    const byLine = blameGroupByLine(groups);
    expect(byLine.get(1)).toBe(groups[0]);
    expect(byLine.get(2)).toBe(groups[0]);
    expect(byLine.get(3)).toBeUndefined();
  });
});
