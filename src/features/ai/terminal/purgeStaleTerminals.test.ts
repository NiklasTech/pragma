import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

vi.hoisted(() => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage, addEventListener: () => {} });
});

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => Promise.resolve(null)) }));
vi.mock("../worktree/cleanup", () => ({ releaseWorktrees: vi.fn(() => Promise.resolve()) }));

import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { createLeaf, createTabs } from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";
import { purgeStaleTerminals } from "./useStaleTerminals";

const ROOT = "/a";

function terminal(id: string): ChatSession {
  return {
    id,
    rootPath: ROOT,
    kind: "terminal",
    cliProviderId: "anthropic-claude",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function paneWith(sessionId: string) {
  return { root: createTabs([createLeaf(sessionId)]), focusedLeafId: null, focusOrder: [] };
}

describe("purgeStaleTerminals", () => {
  const deleted: string[] = [];

  beforeEach(() => {
    deleted.length = 0;
    useOpenRepositoriesStore.getState().clear();
    useOpenRepositoriesStore.getState().add(ROOT);
    useAIStore.setState({
      deleteSession: (id) => {
        deleted.push(id);
        return Promise.resolve();
      },
    });
  });

  it("keeps terminals in tabs that are not active and drops those in no tab", async () => {
    const { spaces, addTab } = useOpenRepositoriesStore.getState();
    const first = spaces[0].tabs[0].id;
    addTab(spaces[0].id, "Agents 2", "agents");
    const second = useOpenRepositoriesStore.getState().spaces[0].activeTabId;
    expect(second).not.toBe(first);
    useAgentsPanesStore.setState({
      trees: { [first]: paneWith("other-tab"), [second]: paneWith("active-tab") },
    });
    useAIStore.setState({
      chatSessions: [terminal("other-tab"), terminal("active-tab"), terminal("nowhere")],
    });

    await purgeStaleTerminals(ROOT);

    expect(deleted).toEqual(["nowhere"]);
  });
});
