import { describe, expect, it } from "vite-plus/test";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

import { countSharers, joinableWorktrees } from "./shared";

function session(id: string, init: Partial<ChatSession> = {}): ChatSession {
  return {
    id,
    rootPath: "/repo",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    kind: "agent",
    ...init,
  };
}

function worktree(id: string, init: Partial<WorkEnvironment> = {}): WorkEnvironment {
  return {
    id,
    rootPath: "/repo",
    kind: "worktree",
    path: `/wt/${id}`,
    branch: `pragma/${id}`,
    setupStatus: "ready",
    setupLog: "",
    ...init,
  };
}

describe("joinableWorktrees", () => {
  it("lists ready worktrees with their listed sessions, newest first", () => {
    const environments = [
      worktree("a"),
      worktree("b", { setupStatus: "error" }),
      worktree("c"),
      worktree("d"),
    ];
    const sessions = [
      session("1", { environmentId: "a", updatedAt: 1 }),
      session("2", { environmentId: "a", updatedAt: 2 }),
      session("3", { environmentId: "b" }),
      session("4", { environmentId: "c", archived: true }),
    ];

    const joinable = joinableWorktrees(environments, sessions);

    expect(joinable.map((item) => item.environment.id)).toEqual(["a"]);
    expect(joinable[0]?.sessions.map((item) => item.id)).toEqual(["2", "1"]);
  });
});

describe("countSharers", () => {
  it("counts the listed sessions of one environment", () => {
    const sessions = [
      session("1", { environmentId: "a" }),
      session("2", { environmentId: "a" }),
      session("3", { environmentId: "a", archived: true }),
      session("4"),
    ];
    expect(countSharers(sessions, "a")).toBe(2);
    expect(countSharers(sessions, undefined)).toBe(0);
  });
});
