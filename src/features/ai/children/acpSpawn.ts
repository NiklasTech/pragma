import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { create } from "zustand";

import { resolveAgentApproval } from "@/features/agent/permissions";
import type { AgentRunContext } from "@/features/agent/runContext";
import type { AgentApproval } from "@/features/agent/store";
import { AGENT_TOOL_NAMES } from "@/features/agent/tools";
import { resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";

import { showSessionInPane } from "./open";
import { runSpawnTool } from "./spawn";

const SPAWN_REQUEST_EVENT = "child_session_spawn_request";

interface SpawnRequestEvent {
  requestId: string;
  chatSessionId: string;
  arguments: unknown;
}

interface SpawnApprovalsState {
  bySession: Record<string, AgentApproval[]>;
}

export const useSpawnApprovalsStore = create<SpawnApprovalsState>()(() => ({ bySession: {} }));

export function requestSpawnApproval(
  sessionId: string,
  approval: Omit<AgentApproval, "resolve">,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useSpawnApprovalsStore.setState((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: [...(state.bySession[sessionId] ?? []), { ...approval, resolve }],
      },
    }));
  });
}

export function resolveSpawnApproval(sessionId: string, toolCallId: string, approved: boolean) {
  const approvals = useSpawnApprovalsStore.getState().bySession[sessionId] ?? [];
  const approval = approvals.find((item) => item.toolCallId === toolCallId);
  if (!approval) return;
  useSpawnApprovalsStore.setState((state) => ({
    bySession: {
      ...state.bySession,
      [sessionId]: approvals.filter((item) => item.toolCallId !== toolCallId),
    },
  }));
  approval.resolve(approved);
}

function acpContext(parentId: string, cliProviderId: string | null): AgentRunContext {
  return {
    sessionId: () => parentId,
    childEngine: () => (cliProviderId ? { kind: "cli", cliProviderId } : { kind: "builtin" }),
    isCancelled: () => false,
    addStep: () => {},
    updateStep: () => {},
    requestApproval: (approval) => {
      const { activeChatSessionId, chatSessions } = useAIStore.getState();
      if (activeChatSessionId !== parentId) {
        const title = chatSessions.find((item) => item.id === parentId)?.title ?? "A session";
        const rootPath = useFileExplorerStore.getState().rootPath ?? "default";
        toast(`${title} wants to start a child session`, {
          action: { label: "Open", onClick: () => showSessionInPane(rootPath, parentId) },
        });
      }
      return requestSpawnApproval(parentId, approval);
    },
    setTodos: () => 0,
    finishTask: () => {},
    applyFileEdit: () => Promise.reject(new Error("Coding CLIs edit files themselves")),
  };
}

export async function handleSpawnRequest(event: SpawnRequestEvent): Promise<void> {
  const ai = useAIStore.getState();
  const parent = ai.chatSessions.find((session) => session.id === event.chatSessionId);
  // Every window hears the event; only the one that holds the parent answers it.
  if (!parent) return;

  const engine = resolveEffectiveEngine(parent.agentEngine ?? null, ai);
  const cliProviderId = engine.cliProviderId ?? parent.cliProviderId ?? null;
  const settings = useSettingsStore.getState();
  const decision = resolveAgentApproval(
    AGENT_TOOL_NAMES.spawnSession,
    event.arguments,
    settings.agent,
    settings.ai.yoloMode,
  );
  const outcome = await runSpawnTool(
    event.requestId,
    AGENT_TOOL_NAMES.spawnSession,
    event.arguments,
    decision,
    acpContext(parent.id, cliProviderId),
  );
  const ok = "output" in outcome.result;
  const text = "output" in outcome.result ? outcome.result.output : outcome.result.errorText;
  await invoke("child_session_spawn_reply", {
    req: { request_id: event.requestId, ok, text },
  }).catch(() => {});
}

/// Answers coding CLIs that ask Pragma to start a child session.
export function useAcpSpawnRequests(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      try {
        unlisten = await listen<SpawnRequestEvent>(SPAWN_REQUEST_EVENT, (event) => {
          void handleSpawnRequest(event.payload);
        });
      } catch {
        // Tauri is unavailable outside the desktop runtime.
      }
      if (!active) {
        void unlistenQuietly(unlisten);
        unlisten = undefined;
      }
    })();

    return () => {
      active = false;
      void unlistenQuietly(unlisten);
    };
  }, []);
}
