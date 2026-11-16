import { describe, expect, it } from "vite-plus/test";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

import { agentWorktreeFor } from "./agentWorktree";

function environment(id: string, path: string, kind: WorkEnvironment["kind"]): WorkEnvironment {
  return { id, rootPath: "/repo", kind, path, branch: "", setupStatus: "ready", setupLog: "" };
}

function session(id: string, environmentId: string, patch: Partial<ChatSession> = {}): ChatSession {
  return {
    id,
    rootPath: "/repo",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    environmentId,
    ...patch,
  };
}

const environments = [
  environment("main", "/repo", "checkout"),
  environment("wt", "/home/me/.pragma/wt/fix-diff", "worktree"),
];

describe("agentWorktreeFor", () => {
  it("finds the worktree a file lies in and the agent working there", () => {
    const sessions = [session("a", "wt", { cliProviderId: "openai-codex" })];
    expect(
      agentWorktreeFor("/home/me/.pragma/wt/fix-diff/src/diff.rs", environments, sessions),
    ).toEqual({
      path: "/home/me/.pragma/wt/fix-diff",
      agentId: "openai-codex",
    });
  });

  it("ignores files of the checkout and folders that only share a prefix", () => {
    expect(agentWorktreeFor("/repo/src/main.rs", environments, [])).toBeNull();
    expect(agentWorktreeFor("/home/me/.pragma/wt/fix-diff-2/a.rs", environments, [])).toBeNull();
  });

  it("skips archived sessions and matches Windows paths", () => {
    const windows = [environment("wt", "C:\\Users\\me\\wt\\task", "worktree")];
    const sessions = [session("old", "wt", { cliProviderId: "anthropic-claude", archived: true })];
    expect(agentWorktreeFor("C:\\Users\\me\\wt\\task\\a.ts", windows, sessions)).toEqual({
      path: "C:\\Users\\me\\wt\\task",
      agentId: undefined,
    });
  });
});
