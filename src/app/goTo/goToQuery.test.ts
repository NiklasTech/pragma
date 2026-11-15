import { describe, expect, it } from "vite-plus/test";

import { highlightParts, labelScore, parseGoToQuery, rankByLabel } from "./goToQuery";

describe("parseGoToQuery", () => {
  it("reads the prefixes", () => {
    expect(parseGoToQuery("> git")).toEqual({ scope: "commands", text: "git" });
    expect(parseGoToQuery("@diff")).toEqual({ scope: "symbols", text: "diff" });
    expect(parseGoToQuery("#review")).toEqual({ scope: "agents", text: "review" });
    expect(parseGoToQuery(" main.tsx ")).toEqual({ scope: "all", text: "main.tsx" });
  });
});

describe("labelScore and rankByLabel", () => {
  it("prefers a match at the start of a word", () => {
    const start = labelScore("Git: Show untracked files", "show");
    const middle = labelScore("Git: Reshow files", "show");
    expect(start).not.toBeNull();
    expect(middle).not.toBeNull();
    expect(start ?? 0).toBeGreaterThan(middle ?? 0);
    expect(labelScore("Open folder", "zzz")).toBeNull();
  });

  it("keeps the best matches up to the limit", () => {
    const labels = ["Toggle terminal", "Open terminal", "Close tab", "Terminal: clear"];
    expect(rankByLabel(labels, "terminal", (item) => item, 2)).toEqual([
      "Terminal: clear",
      "Open terminal",
    ]);
    expect(rankByLabel(labels, "", (item) => item, 2)).toEqual([
      "Toggle terminal",
      "Open terminal",
    ]);
  });
});

describe("highlightParts", () => {
  it("splits around the first match, ignoring case", () => {
    expect(highlightParts("fn untracked_file_diff", "Untracked")).toEqual({
      before: "fn ",
      match: "untracked",
      after: "_file_diff",
    });
    expect(highlightParts("abc", "x")).toEqual({ before: "abc", match: "", after: "" });
  });
});
