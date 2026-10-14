import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import type { ChatSession } from "@/shared/stores/ai";

import { selectRunningSessions } from "./runningSessions";

function session(id: string, rootPath: string, kind?: ChatSession["kind"]): ChatSession {
  return { id, rootPath, title: id, messages: [], createdAt: 0, updatedAt: 0, kind };
}

const sessions = [
  session("a-run", "/a"),
  session("a-wait", "/a"),
  session("a-idle", "/a"),
  session("a-term", "/a", "terminal"),
  session("a-exited", "/a", "terminal"),
  session("b-run", "/b"),
];

describe("selectRunningSessions", () => {
  it("lists the running, waiting and terminal sessions of one repository", () => {
    const running = selectRunningSessions(
      sessions,
      "/a",
      { running: ["a-run", "b-run"], waiting: ["a-wait"] },
      (sessionId) => sessionId === "a-term",
    );

    expect(running.map((item) => item.id)).toEqual(["a-run", "a-wait", "a-term"]);
  });

  it("finds nothing in a repository whose sessions are idle", () => {
    expect(
      selectRunningSessions(sessions, "/a", { running: ["b-run"], waiting: [] }, () => false),
    ).toEqual([]);
  });
});
