import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";

import { sessionCwd } from "../worktree/cwd";
import { BROWSER_TOOLS } from "./browserTools";
import { CODE_TOOLS } from "./codeTools";
import { EDITOR_TOOLS } from "./editorTools";
import { SESSION_TOOLS } from "./sessionTools";
import { TASK_TOOLS } from "./taskTools";
import { USER_TOOLS } from "./userTools";
import { WORKSPACE_TOOLS } from "./workspaceTools";
import type { PragmaToolHandler } from "./types";

const PRAGMA_TOOL_EVENT = "pragma_tool_request";

/** The built-in tools by name; each group adds its handlers here. */
export const PRAGMA_TOOLS: Record<string, PragmaToolHandler> = {
  ...CODE_TOOLS,
  ...EDITOR_TOOLS,
  ...USER_TOOLS,
  ...SESSION_TOOLS,
  ...TASK_TOOLS,
  ...BROWSER_TOOLS,
  ...WORKSPACE_TOOLS,
};

interface PragmaToolEvent {
  requestId: string;
  chatSessionId: string;
  arguments: unknown;
  tool?: string;
}

export async function handlePragmaToolRequest(event: PragmaToolEvent): Promise<void> {
  const { chatSessions, workEnvironments } = useAIStore.getState();
  const session = chatSessions.find((item) => item.id === event.chatSessionId);
  // Every window hears the event; only the one that holds the session answers it.
  if (!session) return;

  let ok = true;
  let text: string;
  try {
    const handler = event.tool ? PRAGMA_TOOLS[event.tool] : undefined;
    if (!handler) throw new Error(`Unknown tool: ${event.tool ?? ""}`);
    text = await handler(event.arguments, {
      sessionId: session.id,
      requestId: event.requestId,
      cwd: sessionCwd(session, workEnvironments, session.rootPath),
      rootPath: session.rootPath,
    });
  } catch (err) {
    ok = false;
    text = err instanceof Error ? err.message : String(err);
  }
  await invoke("child_session_spawn_reply", {
    req: { request_id: event.requestId, ok, text },
  }).catch(() => {});
}

/// Answers coding CLIs that call Pragma's built-in tools, such as the language server tools.
export function useAcpPragmaTools(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      try {
        unlisten = await listen<PragmaToolEvent>(PRAGMA_TOOL_EVENT, (event) => {
          void handlePragmaToolRequest(event.payload);
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
