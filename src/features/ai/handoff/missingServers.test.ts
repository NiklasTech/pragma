import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      workEnvironments: [{ id: "env-1", path: "/worktrees/one", setupStatus: "ready" }],
    }),
  },
}));

import { missingMcpServers, missingServersLabel } from "./missingServers";

const session: ChatSession = {
  id: "s1",
  rootPath: "/repo",
  title: "Billing export",
  messages: [],
  createdAt: 0,
  updatedAt: 0,
  kind: "terminal",
  cliProviderId: "anthropic-claude",
  cliAccountDir: "/h/.claude-work",
  environmentId: "env-1",
};

beforeEach(() => vi.clearAllMocks());

describe("missingMcpServers", () => {
  it("compares the two accounts for the folder the session works in", async () => {
    mocks.invoke.mockResolvedValue(["github"]);
    expect(await missingMcpServers(session, null)).toEqual(["github"]);
    expect(mocks.invoke).toHaveBeenCalledWith("claude_mcp_missing", {
      fromDir: "/h/.claude-work",
      toDir: null,
      folder: "/worktrees/one",
    });
  });

  it("stays quiet when an account cannot be read", async () => {
    mocks.invoke.mockRejectedValue("This folder holds no Claude Code account");
    expect(await missingMcpServers(session, "/h/.claude-team")).toEqual([]);
  });
});

describe("missingServersLabel", () => {
  it("names the servers, or says nothing when all are there", () => {
    expect(missingServersLabel([])).toBeNull();
    expect(missingServersLabel(["github"])).toBe("1 MCP server missing there: github");
    expect(missingServersLabel(["db", "github"])).toBe("2 MCP servers missing there: db, github");
  });
});
