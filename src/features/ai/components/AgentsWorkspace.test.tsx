import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

const ai = vi.hoisted(() => ({
  state: {
    chatSessions: [] as Array<{
      id: string;
      title: string;
      messages: unknown[];
      createdAt: number;
      updatedAt: number;
    }>,
    activeChatSessionId: null as string | null,
    loadSessions: async () => {},
    setActiveChatSession: () => {},
    createChatSession: async () => {},
    renameChatSession: async () => {},
    deleteSession: async () => {},
  },
}));

const panes = vi.hoisted(() => ({
  root: null as unknown,
  focusedSessionId: null as string | null,
  leafCount: 0,
  state: {
    trees: {} as Record<string, { focusedLeafId: string | null }>,
    syncSessions: () => {},
  },
}));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: (selector: (state: typeof ai.state) => unknown) => selector(ai.state),
}));

vi.mock("@/shared/stores/fileExplorer", () => ({
  useFileExplorerStore: (selector: (state: { rootPath: string | null }) => unknown) =>
    selector({ rootPath: "/workspace" }),
}));

vi.mock("./ChatPanel", () => ({
  ChatPanel: () => <div data-region="chat-panel" />,
}));

vi.mock("../panes/store", () => ({
  useAgentsPanesStore: (selector: (state: typeof panes.state) => unknown) => selector(panes.state),
  selectRoot: () => panes.root,
  selectFocusedSessionId: () => panes.focusedSessionId,
  selectLeafCount: () => panes.leafCount,
}));

import { useAgentStore } from "@/features/agent/store";

import { AgentsWorkspace } from "./AgentsWorkspace";
import { useAgentsUiStore } from "../store/agentsUi";

const TAB_ROOT = {
  type: "tabs" as const,
  id: "tabs-1",
  activeLeafId: "leaf-1",
  children: [{ id: "leaf-1", sessionId: "a" }],
};

describe("AgentsWorkspace", () => {
  beforeEach(() => {
    ai.state.activeChatSessionId = null;
    ai.state.chatSessions = [];
    useAgentsUiStore.setState({ contextPaneCollapsed: true });
    panes.root = null;
    panes.focusedSessionId = null;
    panes.leafCount = 0;
    panes.state.trees = {};
    useAgentStore.setState({
      status: "idle",
      runSessionId: null,
      steps: [],
      todos: [],
      editReviews: [],
      checkpointedPaths: [],
      summary: null,
      error: null,
      goal: "",
      stepCount: 0,
      maxSteps: 30,
    });
  });

  it("renders thread list, transcript and context regions", () => {
    const html = renderToStaticMarkup(<AgentsWorkspace />);

    expect(html).toContain('aria-label="Threads"');
    expect(html).toContain('aria-label="Transcript"');
    expect(html).toContain('aria-label="Context"');
  });

  it("shows the home composer when the pane tree is empty", () => {
    const html = renderToStaticMarkup(<AgentsWorkspace />);

    expect(html).toContain("Ask Pragma to work in this folder");
    expect(html).not.toContain('data-region="chat-panel"');
  });

  it("shows the live transcript when a pane has a session", () => {
    ai.state.activeChatSessionId = "a";
    ai.state.chatSessions = [
      { id: "a", title: "Session A", messages: [], createdAt: 1, updatedAt: 1 },
    ];
    panes.root = TAB_ROOT;
    panes.focusedSessionId = "a";
    panes.leafCount = 1;
    panes.state.trees = { "/workspace": { focusedLeafId: "leaf-1" } };

    const html = renderToStaticMarkup(<AgentsWorkspace />);

    expect(html).toContain('data-region="chat-panel"');
    expect(html).not.toContain("Ask Pragma to work in this folder");
  });
});
