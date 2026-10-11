import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";

import { handleSpawnRequest, resolveSpawnApproval, useSpawnApprovalsStore } from "./acpSpawn";

const request = {
  requestId: "req-1",
  chatSessionId: "parent",
  arguments: { title: "Review", prompt: "Review the diff", environment: "checkout" },
};

function replies() {
  return invokeMock.mock.calls.filter(([command]) => command === "child_session_spawn_reply");
}

describe("handleSpawnRequest", () => {
  beforeAll(async () => {
    await import("./spawn");
  });

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    useSpawnApprovalsStore.setState({ bySession: {} });
    useFileExplorerStore.setState({ rootPath: "/workspace" });
    useAIStore.setState({
      activeChatSessionId: "parent",
      chatSessions: [
        {
          id: "parent",
          title: "Parent",
          messages: [],
          createdAt: 0,
          updatedAt: 0,
          kind: "agent",
          agentEngine: { kind: "cli", cliProviderId: "anthropic-claude" },
        },
      ],
    });
    const settings = useSettingsStore.getState();
    useSettingsStore.setState({
      agent: { ...settings.agent, autoApprove: "never" },
      ai: { ...settings.ai, yoloMode: false },
    });
  });

  it("ignores a request for a session another window holds", async () => {
    await handleSpawnRequest({ ...request, chatSessionId: "elsewhere" });
    expect(replies()).toEqual([]);
  });

  it("answers a denial without creating a session", async () => {
    const handled = handleSpawnRequest(request);
    await vi.waitFor(() =>
      expect(useSpawnApprovalsStore.getState().bySession.parent).toHaveLength(1),
    );
    resolveSpawnApproval("parent", "req-1", false);
    await handled;

    expect(replies()).toEqual([
      [
        "child_session_spawn_reply",
        {
          req: {
            request_id: "req-1",
            ok: false,
            text: "The user denied starting a child session",
          },
        },
      ],
    ]);
    expect(useAIStore.getState().chatSessions).toHaveLength(1);
  });

  it("reports a limit error to the coding CLI", async () => {
    await handleSpawnRequest({ ...request, arguments: { title: "", prompt: "x" } });
    expect(replies()[0][1].req.ok).toBe(false);
    expect(replies()[0][1].req.text).toContain("title");
  });
});
