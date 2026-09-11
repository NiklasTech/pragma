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
    setActiveChatSession: () => {},
    createChatSession: async () => {},
    renameChatSession: async () => {},
    deleteSession: async () => {},
  },
}));

const agent = vi.hoisted(() => ({ status: "idle" }));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: (selector: (state: typeof ai.state) => unknown) => selector(ai.state),
}));

vi.mock("@/shared/stores/fileExplorer", () => ({
  useFileExplorerStore: (selector: (state: { rootPath: string | null }) => unknown) =>
    selector({ rootPath: "/workspace" }),
}));

vi.mock("@/features/agent/store", () => ({
  useAgentStore: (selector: (state: { status: string }) => unknown) => selector(agent),
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
  });

  it("marks the active thread as selected", () => {
    ai.state.chatSessions = [session("b", "Session B", 2), session("a", "Session A", 1)];
    ai.state.activeChatSessionId = "a";

    const html = renderToStaticMarkup(<ThreadList />);

    expect(html).toContain("Session A");
    expect(html).toContain("Session B");
    expect(html.match(/aria-current="true"/g) ?? []).toHaveLength(1);
  });

  it("shows the live run status only on the active thread", () => {
    ai.state.chatSessions = [session("a", "Session A", 2), session("b", "Session B", 1)];
    ai.state.activeChatSessionId = "a";
    agent.status = "running";

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
});
