import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useRepositorySettingsStore } from "@/shared/stores/workspaceSettings/repositories";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";

import { foregroundRunContext, type AgentRunContext } from "./runContext";
import { runAgentSettings, runRepository } from "./runSettings";

function contextFor(sessionId: string | null): AgentRunContext {
  return { ...foregroundRunContext, sessionId: () => sessionId };
}

describe("runAgentSettings", () => {
  beforeEach(() => {
    useAIStore.setState({
      chatSessions: [
        { id: "in-b", rootPath: "/b", title: "B", messages: [], createdAt: 0, updatedAt: 0 },
      ],
    });
    useWorkspaceSettingsStore.setState({
      rootPath: "/a",
      settings: { agent: { stepLimit: 10 } },
      error: null,
    });
    useRepositorySettingsStore.setState({
      byRoot: { "/b": { settings: { agent: { stepLimit: 20 } }, trusted: false } },
    });
    const settings = useSettingsStore.getState();
    useSettingsStore.setState({ agent: { ...settings.agent, stepLimit: 50 } });
  });

  it("uses the repository of the run's session while another one is active", () => {
    expect(runRepository(contextFor("in-b"))).toBe("/b");
    expect(runAgentSettings(contextFor("in-b")).stepLimit).toBe(20);
  });

  it("falls back to the active repository for an unknown session", () => {
    expect(runRepository(contextFor(null))).toBeUndefined();
    expect(runAgentSettings(contextFor(null)).stepLimit).toBe(10);
  });
});
