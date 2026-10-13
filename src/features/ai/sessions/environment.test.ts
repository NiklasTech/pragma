import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

import { defaultEnvironment, resolveEnvironment, type EnvironmentContext } from "./environment";

function session(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: overrides.id ?? "session",
    title: "Session",
    messages: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function context(overrides: Partial<EnvironmentContext> = {}): EnvironmentContext {
  return { kind: "agent", isRepo: true, sessions: [], ...overrides };
}

describe("defaultEnvironment", () => {
  it("defaults to checkout when there are no sessions", () => {
    expect(defaultEnvironment([], undefined)).toBe("checkout");
  });

  it("ignores ask sessions and worktree sessions", () => {
    const sessions = [
      session({ kind: "ask", environment: "checkout" }),
      session({ kind: "agent", environment: "worktree" }),
    ];

    expect(defaultEnvironment(sessions, undefined)).toBe("checkout");
  });

  it("returns worktree once an agent session uses the checkout", () => {
    expect(defaultEnvironment([session({ kind: "agent" })], undefined)).toBe("worktree");
  });

  it("counts a CLI terminal in the checkout as a writing session", () => {
    const sessions = [session({ kind: "terminal", environment: "checkout" })];

    expect(defaultEnvironment(sessions, undefined)).toBe("worktree");
  });

  it("does not treat an old session without kind as a writing session", () => {
    expect(defaultEnvironment([session()], undefined)).toBe("checkout");
  });

  it("follows the project setting even while the checkout is in use", () => {
    const sessions = [session({ kind: "agent", environment: "checkout" })];

    expect(defaultEnvironment(sessions, "checkout")).toBe("checkout");
    expect(defaultEnvironment([], "worktree")).toBe("worktree");
  });
});

describe("resolveEnvironment", () => {
  it("keeps ask sessions in the checkout", () => {
    expect(resolveEnvironment(context({ kind: "ask", override: "worktree" }))).toBe("checkout");
    expect(resolveEnvironment(context({ kind: "ask", setting: "worktree" }))).toBe("checkout");
  });

  it("uses the checkout outside a git repository", () => {
    expect(resolveEnvironment(context({ isRepo: false, override: "worktree" }))).toBe("checkout");
    expect(resolveEnvironment(context({ isRepo: false, setting: "worktree" }))).toBe("checkout");
  });

  it("lets an explicit choice win over the project setting", () => {
    expect(resolveEnvironment(context({ override: "checkout", setting: "worktree" }))).toBe(
      "checkout",
    );
    expect(resolveEnvironment(context({ override: "worktree", setting: "checkout" }))).toBe(
      "worktree",
    );
  });

  it.each(["agent", "terminal"] as const)("applies the project setting to %s sessions", (kind) => {
    expect(resolveEnvironment(context({ kind, setting: "worktree" }))).toBe("worktree");
    expect(resolveEnvironment(context({ kind, setting: "checkout" }))).toBe("checkout");
  });

  it("falls back to the checkout's use without a setting", () => {
    const sessions = [session({ kind: "agent", environment: "checkout" })];

    expect(resolveEnvironment(context())).toBe("checkout");
    expect(resolveEnvironment(context({ sessions }))).toBe("worktree");
  });
});
