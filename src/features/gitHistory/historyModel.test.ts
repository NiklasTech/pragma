import { describe, expect, it } from "vite-plus/test";

import type { GitLogEntry } from "@/features/sidebar/components/git-graph/types";

import { authorInitial, filterCommits, relativeTime, splitPullRequest } from "./historyModel";

function commit(subject: string, author = "Niklas", sha = "abc1234def"): GitLogEntry {
  return {
    sha,
    short_sha: sha.slice(0, 7),
    author,
    author_email: "",
    timestamp_secs: 0,
    parents: [],
    subject,
    tags: [],
    files_changed: 0,
    insertions: 0,
    deletions: 0,
  };
}

describe("splitPullRequest", () => {
  it("takes the number off a squash-merge subject", () => {
    expect(splitPullRequest("fix: show untracked diffs (#642)")).toEqual({
      title: "fix: show untracked diffs",
      pr: 642,
    });
    expect(splitPullRequest("chore: release v0.7.2")).toEqual({
      title: "chore: release v0.7.2",
      pr: null,
    });
  });
});

describe("relativeTime", () => {
  const now = 1_000_000_000;
  it("reads like the board", () => {
    expect(relativeTime(now - 20, now)).toBe("just now");
    expect(relativeTime(now - 120, now)).toBe("2m ago");
    expect(relativeTime(now - 3 * 3600, now)).toBe("3h ago");
    expect(relativeTime(now - 86400, now)).toBe("1 day ago");
    expect(relativeTime(now - 5 * 86400, now)).toBe("5 days ago");
    expect(relativeTime(now - 21 * 86400, now)).toBe("3 weeks ago");
  });
});

describe("filterCommits", () => {
  const commits = [
    commit("fix: untracked diffs (#642)", "Niklas", "d9e1dd1aaa"),
    commit("chore(deps): bump", "dependabot", "54068ccbbb"),
  ];
  it("matches subject, author, hash and pull request number", () => {
    expect(filterCommits(commits, "untracked")).toHaveLength(1);
    expect(filterCommits(commits, "DEPENDABOT")).toHaveLength(1);
    expect(filterCommits(commits, "54068")).toHaveLength(1);
    expect(filterCommits(commits, "#642")).toHaveLength(1);
    expect(filterCommits(commits, "")).toHaveLength(2);
  });
});

describe("authorInitial", () => {
  it("is the capital first letter", () => {
    expect(authorInitial("dependabot")).toBe("D");
    expect(authorInitial("")).toBe("?");
  });
});
