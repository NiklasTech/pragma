import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";
import type { AgentRunContext } from "@/features/agent/runContext";
import { requestSpawnApproval } from "@/features/ai/children/acpSpawn";

import { extensionToolDefinitions, runExtensionTool } from "./agentTools";
import { useExtensionsStore } from "./store";

const TOOL_REQUEST_EVENT = "extension_tool_request";

interface ToolRequestEvent {
  requestId: string;
  chatSessionId: string;
  tool: string;
  arguments: unknown;
}

function acpToolContext(sessionId: string): AgentRunContext {
  return {
    sessionId: () => sessionId,
    childEngine: () => null,
    isCancelled: () => false,
    addStep: () => {},
    updateStep: () => {},
    requestApproval: (approval) => requestSpawnApproval(sessionId, approval),
    setTodos: () => 0,
    finishTask: () => {},
    applyFileEdit: () => Promise.reject(new Error("Coding CLIs edit files themselves")),
  };
}

async function handleToolRequest(event: ToolRequestEvent): Promise<void> {
  const known = useAIStore
    .getState()
    .chatSessions.some((session) => session.id === event.chatSessionId);
  // Every window hears the event; only the one that holds the session answers it.
  if (!known) return;

  const result = await runExtensionTool(
    { toolCallId: event.requestId, toolName: event.tool, input: event.arguments },
    acpToolContext(event.chatSessionId),
  );
  const ok = "output" in result;
  await invoke("child_session_spawn_reply", {
    req: { request_id: event.requestId, ok, text: ok ? result.output : result.errorText },
  }).catch(() => {});
}

/// Offers extension tools to coding CLIs through Pragma's MCP bridge and answers their calls.
export function useExtensionToolBridge(): void {
  const tools = useExtensionsStore((state) => state.agentTools);

  useEffect(() => {
    const definitions = extensionToolDefinitions(tools).map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      inputSchema: tool.function.parameters,
    }));
    void invoke("extension_tools_sync", { tools: definitions }).catch(() => {});
  }, [tools]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    void (async () => {
      try {
        unlisten = await listen<ToolRequestEvent>(TOOL_REQUEST_EVENT, (event) => {
          void handleToolRequest(event.payload);
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
