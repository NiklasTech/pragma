import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatMessage, WorkEnvironment } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), dirty: false }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import { commitBeforeFinish, pullRequestBody } from "./finish";

const WORKTREE: WorkEnvironment = {
  id: "env-1",
  kind: "worktree",
  path: "/data/worktrees/env-1",
  branch: "pragma/1a2b3c4d",
  setupStatus: "ready",
  setupLog: "",
};

function message(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: content, role, content, timestamp: 0 };
}

describe("pullRequestBody", () => {
  it("prefers the task notes", () => {
    expect(pullRequestBody("  Fix the login flow  ", [message("user", "prompt")])).toBe(
      "Fix the login flow",
    );
  });

  it("falls back to the first user prompt", () => {
    const messages = [
      message("system", "rules"),
      message("user", " Add a Finish menu \n"),
      message("user", "later"),
    ];
    expect(pullRequestBody(null, messages)).toBe("Add a Finish menu");
    expect(pullRequestBody("   ", messages)).toBe("Add a Finish menu");
  });

  it("is empty without notes or prompts", () => {
    expect(pullRequestBody(null, [message("assistant", "hi")])).toBe("");
  });
});

describe("commitBeforeFinish", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.invoke.mockImplementation(async (command: string) =>
      command === "git_session_worktree_dirty" ? mocks.dirty : undefined,
    );
  });

  it("continues without a prompt when the worktree is clean", async () => {
    mocks.dirty = false;
    const prompt = vi.fn(async () => "unused");

    expect(await commitBeforeFinish("/repo", WORKTREE, "Fix login", prompt)).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it("commits the changes with the chosen message, then continues", async () => {
    mocks.dirty = true;
    const prompt = vi.fn(async () => "Fix the login flow");

    expect(await commitBeforeFinish("/repo", WORKTREE, "Fix login", prompt)).toBe(true);
    expect(prompt).toHaveBeenCalledWith("Fix login");
    expect(mocks.invoke).toHaveBeenLastCalledWith("git_session_commit_all", {
      repoPath: "/repo",
      worktreePath: WORKTREE.path,
      branch: WORKTREE.branch,
      message: "Fix the login flow",
    });
  });

  it("cancels without committing when the prompt is dismissed", async () => {
    mocks.dirty = true;

    expect(await commitBeforeFinish("/repo", WORKTREE, "", async () => null)).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalledWith("git_session_commit_all", expect.anything());
  });
});
