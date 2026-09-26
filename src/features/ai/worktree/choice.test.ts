import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

import { defaultEnvironment } from "./choice";

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

describe("defaultEnvironment", () => {
  it("defaults to checkout when there are no sessions", () => {
    expect(defaultEnvironment([], undefined)).toBe("checkout");
  });

  it("ignores ask sessions and keeps the checkout free", () => {
    const sessions = [session({ kind: "ask", environment: "checkout" })];

    expect(defaultEnvironment(sessions, undefined)).toBe("checkout");
  });

  it("ignores worktree sessions when deciding checkout occupancy", () => {
    const sessions = [session({ kind: "agent", environment: "worktree" })];

    expect(defaultEnvironment(sessions, undefined)).toBe("checkout");
  });

  it("returns worktree once an agent session uses the checkout", () => {
    const sessions = [session({ kind: "agent", environment: "checkout" })];

    expect(defaultEnvironment(sessions, undefined)).toBe("worktree");
  });

  it("treats a missing environment as an occupied checkout", () => {
    const sessions = [session({ kind: "agent" })];

    expect(defaultEnvironment(sessions, undefined)).toBe("worktree");
  });

  it("does not treat an old session without kind as a writing session", () => {
    const sessions = [session()];

    expect(defaultEnvironment(sessions, undefined)).toBe("checkout");
  });

  it("uses a remembered worktree only while the checkout is free", () => {
    expect(defaultEnvironment([], "worktree")).toBe("worktree");
  });

  it("never lets a remembered checkout override an occupied checkout", () => {
    const sessions = [session({ kind: "agent", environment: "checkout" })];

    expect(defaultEnvironment(sessions, "checkout")).toBe("worktree");
  });

  it("falls back to checkout for a remembered checkout when the checkout is free", () => {
    expect(defaultEnvironment([], "checkout")).toBe("checkout");
  });
});
