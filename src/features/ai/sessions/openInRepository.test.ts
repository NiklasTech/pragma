import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  activeRoot: "/code/a" as string | null,
  sessions: [] as Array<{ id: string; rootPath: string }>,
  calls: [] as string[],
}));

vi.mock("@/shared/hooks/useFileExplorer", () => ({
  selectRootFolder: async (path: string) => {
    state.calls.push(`activate ${path}`);
    state.activeRoot = path;
    return true;
  },
}));

vi.mock("@/shared/stores/fileExplorer", () => ({
  useFileExplorerStore: { getState: () => ({ rootPath: state.activeRoot }) },
}));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ chatSessions: state.sessions }) },
}));

vi.mock("../children/open", () => ({
  showSessionInPane: (rootPath: string, sessionId: string) => {
    state.calls.push(`show ${sessionId} in ${rootPath}`);
  },
}));

vi.mock("../panes/store", () => ({
  useAgentsPanesStore: { getState: () => ({ openSession: () => {} }) },
}));

import { sessionRepository, showSessionInRepository } from "./openInRepository";

describe("showSessionInRepository", () => {
  beforeEach(() => {
    state.activeRoot = "/code/a";
    state.sessions = [
      { id: "in-a", rootPath: "/code/a" },
      { id: "in-b", rootPath: "/code/b" },
    ];
    state.calls = [];
  });

  it("activates the session's repository before it focuses the session", async () => {
    await showSessionInRepository("in-b");

    expect(state.calls).toEqual(["activate /code/b", "show in-b in /code/b"]);
  });

  it("only focuses a session of the active repository", async () => {
    await showSessionInRepository("in-a");

    expect(state.calls).toEqual(["show in-a in /code/a"]);
  });

  it("falls back to the active repository for an unknown session", () => {
    expect(sessionRepository("gone")).toBe("/code/a");
    state.activeRoot = null;
    expect(sessionRepository("gone")).toBe("default");
  });
});
