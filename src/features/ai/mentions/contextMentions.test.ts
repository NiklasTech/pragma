import { describe, expect, it } from "vite-plus/test";

import {
  formatContextMention,
  parseContextMention,
  splitMentionQuery,
  type ContextMention,
} from "./contextMentions";

describe("context mention tokens", () => {
  const roundTrips: ContextMention[] = [
    { kind: "symbol", name: "createStore", path: "src/store.ts", line: 12 },
    { kind: "symbol", name: "impl Foo for Bar", path: "src/my dir/lib.rs", line: 3 },
    { kind: "problems", path: null },
    { kind: "problems", path: "src/app.tsx" },
    { kind: "diff", target: "staged" },
    { kind: "diff", target: "unstaged" },
    { kind: "diff", target: "commit", sha: "4276862abcde" },
    { kind: "terminal", sessionId: "3f2a9c1e" },
    { kind: "url", url: "https://example.com/docs?page=2" },
    { kind: "skill", id: "release-notes" },
  ];

  it.each(roundTrips)("round-trips $kind", (mention) => {
    const token = formatContextMention(mention);
    expect(token).not.toMatch(/\s/);
    expect(parseContextMention(token)).toEqual(mention);
  });

  it("rejects malformed tokens", () => {
    expect(parseContextMention("src/app.tsx")).toBeNull();
    expect(parseContextMention("symbol:")).toBeNull();
    expect(parseContextMention("symbol:name:src/a.ts:0")).toBeNull();
    expect(parseContextMention("symbol:name:12")).toBeNull();
    expect(parseContextMention("diff:--output=x")).toBeNull();
    expect(parseContextMention("url:file:///etc/passwd")).toBeNull();
    expect(parseContextMention("skill:../secret")).toBeNull();
    expect(parseContextMention("mcp:server:uri")).toBeNull();
  });
});

describe("splitMentionQuery", () => {
  it("splits a known kind from the typed text", () => {
    expect(splitMentionQuery("symbol:create")).toEqual({ kind: "symbol", rest: "create" });
    expect(splitMentionQuery("url:https://a.b")).toEqual({ kind: "url", rest: "https://a.b" });
  });

  it("ignores queries without a known kind", () => {
    expect(splitMentionQuery("sym")).toBeNull();
    expect(splitMentionQuery("src/a.ts")).toBeNull();
    expect(splitMentionQuery("mcp:server")).toBeNull();
  });
});
