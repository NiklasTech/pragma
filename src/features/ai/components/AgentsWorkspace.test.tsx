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

import { useAgentStore } from "@/features/agent/store";

import { AgentsWorkspace } from "./AgentsWorkspace";
import { useAgentsUiStore } from "../store/agentsUi";

describe("AgentsWorkspace", () => {
  beforeEach(() => {
    ai.state.activeChatSessionId = null;
    ai.state.chatSessions = [];
    useAgentsUiStore.setState({ contextPaneCollapsed: true });
    useAgentStore.setState({
      status: "idle",
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

  it("shows the home composer when no thread is active", () => {
    const html = renderToStaticMarkup(<AgentsWorkspace />);

    expect(html).toContain("Ask Pragma to work in this folder");
    expect(html).not.toContain('data-region="chat-panel"');
  });

  it("shows the transcript when a thread is active", () => {
    ai.state.activeChatSessionId = "a";
    ai.state.chatSessions = [
      { id: "a", title: "Session A", messages: [], createdAt: 1, updatedAt: 1 },
    ];

    const html = renderToStaticMarkup(<AgentsWorkspace />);

    expect(html).toContain('data-region="chat-panel"');
    expect(html).not.toContain("Ask Pragma to work in this folder");
  });
});
