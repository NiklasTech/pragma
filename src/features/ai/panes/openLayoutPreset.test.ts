import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";

const mocks = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
  createShellSession: vi.fn(),
  deliverTerminalPrompt: vi.fn(),
  sendChatTasks: vi.fn(),
  assignSession: vi.fn(),
  focusLeaf: vi.fn(),
  placeLayout: vi.fn(),
  manifests: [] as CLIManifest[],
}));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ cliManifests: mocks.manifests }) },
}));
vi.mock("@/shared/stores/openRepositories", () => ({
  useOpenRepositoriesStore: { getState: () => ({ spaces: [], addTab: () => "tab" }) },
}));
vi.mock("@/shared/stores/spaces/model", () => ({ findSpaceByFolder: () => ({ id: "space" }) }));
vi.mock("../children/terminalPrompt", () => ({
  deliverTerminalPrompt: mocks.deliverTerminalPrompt,
}));
vi.mock("../terminal/shell", () => ({
  SHELL_PROVIDER_ID: "shell",
  createShellSession: mocks.createShellSession,
}));
vi.mock("./launch", () => ({ createAgentSession: mocks.createAgentSession }));
vi.mock("./chatTasks", () => ({ sendChatTasks: mocks.sendChatTasks }));
vi.mock("./store", () => ({
  useAgentsPanesStore: {
    getState: () => ({
      assignSession: mocks.assignSession,
      focusLeaf: mocks.focusLeaf,
      placeLayout: mocks.placeLayout,
    }),
  },
}));

import { QUICK_LAYOUTS, agentPane } from "../quickStart/quickStart";
import { openLayoutPreset } from "./openLayoutPreset";

const claude = {
  id: "claude",
  name: "Claude Code",
  uses_acp: true,
  offers_terminal: true,
} as CLIManifest;

describe("openLayoutPreset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manifests = [claude];
    mocks.createAgentSession.mockResolvedValue({ id: "agent" });
    let shells = 0;
    mocks.createShellSession.mockImplementation(async () => ({ id: `shell-${++shells}` }));
  });

  it("starts a chat beside two shells, focuses it and leaves the task to it", async () => {
    const layout = QUICK_LAYOUTS[1].build(agentPane({ kind: "cli", manifestId: "claude" }, "chat"));
    await openLayoutPreset("/repo", { id: "q", name: "Q", layout }, { task: "Fix it" });

    expect(mocks.createAgentSession.mock.calls[0][2]).toBe("chat");
    expect(mocks.assignSession.mock.calls.map(([, , id]) => id)).toEqual([
      "agent",
      "shell-1",
      "shell-2",
    ]);
    const agentLeaf = mocks.assignSession.mock.calls[0][1];
    expect(mocks.focusLeaf).toHaveBeenCalledWith("/repo", agentLeaf);
    expect(mocks.sendChatTasks).toHaveBeenCalledWith("/repo", [
      { sessionId: "agent", prompt: "Fix it" },
    ]);
    expect(mocks.deliverTerminalPrompt).not.toHaveBeenCalled();
  });

  it("types the task into a terminal agent, also when a CLI has no chat", async () => {
    mocks.manifests = [{ ...claude, uses_acp: false }];
    const layout = agentPane({ kind: "cli", manifestId: "claude" }, "chat");
    await openLayoutPreset("/repo", { id: "q", name: "Q", layout }, { task: "Fix it" });

    expect(mocks.createAgentSession.mock.calls[0][2]).toBe("terminal");
    expect(mocks.deliverTerminalPrompt).toHaveBeenCalledWith("agent", "Fix it");
    expect(mocks.sendChatTasks).toHaveBeenCalledWith("/repo", []);
  });
});
