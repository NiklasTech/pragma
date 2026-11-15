import { describe, expect, it } from "vite-plus/test";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";
import { createSpace } from "@/shared/stores/spaces/model";

import { spaceState, spaceSubtitle, worktreeRows } from "./spaceSummary";

const session = (id: string, extra: Partial<ChatSession> = {}) =>
  ({
    id,
    rootPath: "/repo",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: Number(id.replace(/\D/g, "")) || 0,
    ...extra,
  }) as ChatSession;

const worktree = {
  id: "env-1",
  rootPath: "/repo",
  kind: "worktree",
  path: "/wt/fix",
  branch: "fix/a",
  setupStatus: "ready",
  setupLog: "",
} as WorkEnvironment;

describe("worktreeRows", () => {
  it("lists the main checkout first and each worktree with its sessions", () => {
    const sessions = [
      session("s1"),
      session("s2", { environment: "worktree", environmentId: "env-1" }),
      session("s3"),
      session("s4", { rootPath: "/other" }),
    ];
    const rows = worktreeRows("/repo", "main", [worktree], sessions);
    expect(rows.map((row) => row.branch)).toEqual(["main", "fix/a"]);
    expect(rows[0].sessions.map((item) => item.id)).toEqual(["s3", "s1"]);
    expect(rows[1].sessions.map((item) => item.id)).toEqual(["s2"]);
  });
});

describe("spaceState", () => {
  it("shows the most urgent state of the space's sessions", () => {
    const space = createSpace("/repo");
    const sessions = [session("s1"), session("s2")];
    expect(spaceState(space, sessions, { waiting: ["s2"], running: ["s1"] })).toBe("needs-you");
    expect(spaceState(space, sessions, { waiting: [], running: ["s1"] })).toBe("working");
    expect(spaceState(space, sessions, { waiting: ["x"], running: [] })).toBe("idle");
  });

  it("describes agents and tabs", () => {
    expect(spaceSubtitle(createSpace("/repo"), 0)).toMatch(/^no agents · \d+ tabs?$/);
    expect(spaceSubtitle(createSpace("/repo"), 1)).toMatch(/^1 agent · /);
  });
});
