import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";

import { runOpenBrowserTool } from "./agentTool";

const BROWSER_REQUEST_EVENT = "browser_open_request";

interface BrowserRequestEvent {
  requestId: string;
  chatSessionId: string;
  arguments: unknown;
}

async function handleBrowserRequest(event: BrowserRequestEvent): Promise<void> {
  const known = useAIStore
    .getState()
    .chatSessions.some((session) => session.id === event.chatSessionId);
  // Every window hears the event; only the one that holds the session answers it.
  if (!known) return;

  let ok = true;
  let text: string;
  try {
    text = runOpenBrowserTool(event.arguments);
  } catch (err) {
    ok = false;
    text = err instanceof Error ? err.message : String(err);
  }
  await invoke("child_session_spawn_reply", {
    req: { request_id: event.requestId, ok, text },
  }).catch(() => {});
}

/// Answers coding CLIs that ask Pragma to show a URL in the browser pane.
export function useAcpBrowserRequests(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      try {
        unlisten = await listen<BrowserRequestEvent>(BROWSER_REQUEST_EVENT, (event) => {
          void handleBrowserRequest(event.payload);
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
