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
      category?: string;
    }>,
    activeChatSessionId: null as string | null,
    cliManifests: [] as unknown[],
    cliStatuses: {} as Record<string, unknown>,
    setActiveChatSession: () => {},
    setActiveCLIProvider: () => {},
    setActiveProvider: () => {},
    loadCLIManifests: async () => {},
    loadCLIStatuses: async () => {},
    createChatSession: async () => {},
    renameChatSession: async () => {},
    deleteSession: async () => {},
  },
}));

const agent = vi.hoisted(() => ({
  status: "idle",
  runSessionId: null as string | null,
  modeActive: false,
  requestStop: () => {},
}));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: Object.assign((selector: (state: typeof ai.state) => unknown) => selector(ai.state), {
    getState: () => ai.state,
  }),
}));

vi.mock("@/shared/stores/fileExplorer", () => ({
  useFileExplorerStore: (selector: (state: { rootPath: string | null }) => unknown) =>
    selector({ rootPath: "/workspace" }),
}));

vi.mock("@/features/agent/store", () => ({
  useAgentStore: Object.assign((selector: (state: typeof agent) => unknown) => selector(agent), {
    getState: () => agent,
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => ({ is_repo: true, reason: null })),
}));

import { ThreadList } from "./ThreadList";

function session(id: string, title: string, updatedAt: number) {
  return { id, title, messages: [], createdAt: updatedAt, updatedAt };
}

describe("ThreadList", () => {
  beforeEach(() => {
    ai.state.chatSessions = [];
    ai.state.activeChatSessionId = null;
    agent.status = "idle";
    agent.runSessionId = null;
    agent.modeActive = false;
  });

  it("marks the active thread as selected", () => {
    ai.state.chatSessions = [session("b", "Session B", 2), session("a", "Session A", 1)];
    ai.state.activeChatSessionId = "a";

    const html = renderToStaticMarkup(<ThreadList />);

    expect(html).toContain("Session A");
    expect(html).toContain("Session B");
    expect(html.match(/aria-current="true"/g) ?? []).toHaveLength(1);
  });

  it("shows the live run status only on the run owner", () => {
    ai.state.chatSessions = [session("a", "Session A", 2), session("b", "Session B", 1)];
    ai.state.activeChatSessionId = "b";
    agent.status = "running";
    agent.runSessionId = "a";

    const html = renderToStaticMarkup(<ThreadList />);

    expect(html).toContain('data-thread-status="running"');
    expect(html).toContain('data-thread-status="idle"');
    expect(html).toContain("animate-pulse");
  });

  it("hides search until the list grows past the threshold", () => {
    ai.state.chatSessions = [session("a", "Session A", 1), session("b", "Session B", 2)];
    const shortList = renderToStaticMarkup(<ThreadList />);
    expect(shortList).not.toContain('aria-label="Search threads"');

    ai.state.chatSessions = Array.from({ length: 9 }, (_, index) =>
      session(`s-${index}`, `Session ${index}`, index),
    );
    const longList = renderToStaticMarkup(<ThreadList />);
    expect(longList).toContain('aria-label="Search threads"');
  });

  it("groups categorized threads into their own sections", () => {
    ai.state.chatSessions = [
      { ...session("a", "Session A", Date.now()), category: "Research" },
      session("b", "Session B", Date.now()),
    ];

    const html = renderToStaticMarkup(<ThreadList />);

    expect(html).toContain('aria-label="Research"');
    expect(html).toContain('aria-expanded="true"');
    expect(html.indexOf("Session A")).toBeLessThan(html.indexOf("Session B"));
  });

  it("offers a selection toggle once threads exist", () => {
    expect(renderToStaticMarkup(<ThreadList />)).not.toContain('aria-label="Select threads"');

    ai.state.chatSessions = [session("a", "Session A", 1)];
    expect(renderToStaticMarkup(<ThreadList />)).toContain('aria-label="Select threads"');
  });
});
