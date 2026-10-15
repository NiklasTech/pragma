import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

import type { DashboardState, StateEntry } from "./dashboard";
import { needsAttention, sessionsToOpen, summarizeRepositories } from "./repositories";

function session(id: string, rootPath: string, extra: Partial<ChatSession> = {}): ChatSession {
  return { id, rootPath, title: id, messages: [], createdAt: 0, updatedAt: 100, ...extra };
}

function entry(state: DashboardState, since = 0): StateEntry {
  return { state, since };
}

const PATHS = ["/code/pragma", "/code/test-repo", "/code/empty"];

describe("summarizeRepositories", () => {
  it("counts the working sessions of each open repository", () => {
    const sessions = [
      session("p1", "/code/pragma"),
      session("p2", "/code/pragma"),
      session("t1", "/code/test-repo"),
      session("t2", "/code/test-repo"),
      session("t3", "/code/test-repo"),
      session("t4", "/code/test-repo"),
    ];
    const entries = Object.fromEntries(sessions.map((item) => [item.id, entry("working")]));

    const summaries = summarizeRepositories(PATHS, sessions, entries);

    expect(summaries.map((summary) => [summary.name, summary.sessions.working.length])).toEqual([
      ["pragma", 2],
      ["test-repo", 4],
      ["empty", 0],
    ]);
  });

  it("groups by state and leaves idle sessions out", () => {
    const sessions = [
      session("w", "/code/pragma"),
      session("a", "/code/pragma"),
      session("f", "/code/pragma"),
      session("d", "/code/pragma"),
      session("i", "/code/pragma"),
    ];
    const entries = {
      w: entry("working"),
      a: entry("waiting"),
      f: entry("failed"),
      d: entry("finished"),
      i: entry("idle"),
    };

    const [pragma] = summarizeRepositories(["/code/pragma"], sessions, entries);

    expect(pragma.sessions).toEqual({
      waiting: ["a"],
      working: ["w"],
      failed: ["f"],
      finished: ["d"],
    });
  });

  it("marks a repository with a session waiting for approval", () => {
    const sessions = [session("a", "/code/test-repo"), session("b", "/code/pragma")];
    const entries = { a: entry("waiting"), b: entry("working") };

    const summaries = summarizeRepositories(PATHS, sessions, entries);

    expect(summaries.map(needsAttention)).toEqual([false, true, false]);
  });

  it("ignores archived sessions and sessions of closed repositories", () => {
    const sessions = [
      session("a", "/code/pragma", { archived: true }),
      session("b", "/code/closed"),
    ];
    const entries = { a: entry("working"), b: entry("working") };

    const summaries = summarizeRepositories(PATHS, sessions, entries);

    expect(summaries.every((summary) => summary.sessions.working.length === 0)).toBe(true);
    expect(summaries[0].latestSessionId).toBeNull();
  });

  it("orders the sessions of a state by their latest change", () => {
    const sessions = [session("old", "/code/pragma"), session("new", "/code/pragma")];
    const entries = { old: entry("working", 10), new: entry("working", 50) };

    const [pragma] = summarizeRepositories(["/code/pragma"], sessions, entries);

    expect(pragma.sessions.working).toEqual(["new", "old"]);
  });

  it("remembers the most recently updated session", () => {
    const sessions = [
      session("a", "/code/pragma", { updatedAt: 10 }),
      session("b", "/code/pragma", { updatedAt: 30 }),
    ];

    const [pragma] = summarizeRepositories(["/code/pragma"], sessions, {});

    expect(pragma.latestSessionId).toBe("b");
  });
});

describe("sessionsToOpen", () => {
  it("opens sessions that need the user before running and ended ones", () => {
    const sessions = [
      session("d", "/code/pragma"),
      session("w", "/code/pragma"),
      session("a", "/code/pragma"),
    ];
    const entries = { d: entry("finished"), w: entry("working"), a: entry("waiting") };

    const [pragma] = summarizeRepositories(["/code/pragma"], sessions, entries);

    expect(sessionsToOpen(pragma)).toEqual(["a", "w", "d"]);
  });

  it("caps the sessions at the pane limit", () => {
    const sessions = Array.from({ length: 10 }, (_, index) => session(`s${index}`, "/code/pragma"));
    const entries = Object.fromEntries(sessions.map((item) => [item.id, entry("working")]));

    const [pragma] = summarizeRepositories(["/code/pragma"], sessions, entries);

    expect(sessionsToOpen(pragma)).toHaveLength(8);
  });

  it("falls back to the latest session when none is active", () => {
    const sessions = [
      session("a", "/code/pragma", { updatedAt: 10 }),
      session("b", "/code/pragma", { updatedAt: 30 }),
    ];
    const entries = { a: entry("idle"), b: entry("idle") };

    const [pragma] = summarizeRepositories(["/code/pragma"], sessions, entries);

    expect(sessionsToOpen(pragma)).toEqual(["b"]);
  });

  it("opens nothing in a repository without sessions", () => {
    const [empty] = summarizeRepositories(["/code/empty"], [], {});

    expect(sessionsToOpen(empty)).toEqual([]);
  });
});
