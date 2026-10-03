"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { toolDisplayName, type McpChatTool } from "@/shared/lib/ai/mcpTools";
import { isMcpServerAllowed, mcpSelectionKey } from "@/features/ai/mcp/selection";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpServerState {
  config: { id: string; name: string };
  status: "stopped" | "starting" | "running" | "error";
}

export type { McpChatTool };

// Status events drive updates; the poll only catches servers added or removed by a config reload.
const POLL_INTERVAL_MS = 5000;

function sameTools(prev: Record<string, McpTool[]>, next: Record<string, McpTool[]>): boolean {
  const prevIds = Object.keys(prev);
  if (prevIds.length !== Object.keys(next).length) return false;
  return prevIds.every((id) => JSON.stringify(prev[id]) === JSON.stringify(next[id]));
}

/// Tools of the running MCP servers; `allowedServerIds` limits them to a session's selection.
export function useMcpChatTools(allowedServerIds: string[] | null = null) {
  const serversRef = useRef<Record<string, McpServerState["status"]>>({});
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [toolsByServer, setToolsByServer] = useState<Record<string, McpTool[]>>({});
  const [loaded, setLoaded] = useState(false);

  const fetchTools = useCallback(async (serverMap: Record<string, McpServerState["status"]>) => {
    const serverIds = Object.keys(serverMap);

    if (serverIds.length === 0) {
      return;
    }

    const fetched: Record<string, McpTool[]> = {};
    for (const id of serverIds) {
      try {
        fetched[id] = await invoke<McpTool[]>("mcp_list_tools", { id });
      } catch {}
    }

    setToolsByServer((prev) => {
      const next: Record<string, McpTool[]> = {};
      for (const id of serverIds) {
        next[id] = fetched[id] ?? prev[id] ?? [];
      }
      return sameTools(prev, next) ? prev : next;
    });
  }, []);

  const loadServers = useCallback(async () => {
    try {
      const result = await invoke<McpServerState[]>("mcp_list_servers");
      const next: Record<string, McpServerState["status"]> = {};
      for (const server of result) {
        next[server.config.id] = server.status;
      }
      serversRef.current = next;
      setServerIds(result.map((server) => server.config.id));
      await fetchTools(next);
      setLoaded(true);
    } catch {}
  }, [fetchTools]);

  useEffect(() => {
    void loadServers();
    const interval = setInterval(() => void loadServers(), POLL_INTERVAL_MS);

    let unlisten: (() => void) | undefined;
    let unlistenListChanged: (() => void) | undefined;
    let active = true;

    void (async () => {
      unlisten = await listen<{ server_id: string; status: McpServerState["status"] }>(
        "mcp_status_changed",
        (event) => {
          serversRef.current = {
            ...serversRef.current,
            [event.payload.server_id]: event.payload.status,
          };
          void fetchTools(serversRef.current).finally(() => setLoaded(true));
        },
      );
      unlistenListChanged = await listen<{ server_id: string; kind: string }>(
        "mcp_list_changed",
        (event) => {
          if (event.payload.kind === "tools") void fetchTools(serversRef.current);
        },
      );
      if (!active) {
        void unlistenQuietly(unlisten);
        void unlistenQuietly(unlistenListChanged);
        unlisten = undefined;
        unlistenListChanged = undefined;
      }
    })();

    return () => {
      active = false;
      clearInterval(interval);
      void unlistenQuietly(unlisten);
      void unlistenQuietly(unlistenListChanged);
    };
  }, [loadServers, fetchTools]);

  const allowedKey = mcpSelectionKey(allowedServerIds);
  const allowed = useMemo(
    () => (allowedKey === "*" ? null : allowedKey.split("\n").filter(Boolean)),
    [allowedKey],
  );

  const chatTools = useMemo<McpChatTool[]>(
    () =>
      Object.entries(toolsByServer)
        .filter(([serverId]) => isMcpServerAllowed(allowed, serverId))
        .flatMap(([serverId, tools]) =>
          tools.map((tool) => ({
            serverId,
            toolName: tool.name,
            displayName: toolDisplayName(serverId, tool.name),
            description: tool.description,
            parameters: tool.inputSchema ?? {},
          })),
        ),
    [toolsByServer, allowed],
  );

  const resolveTool = useCallback(
    (displayName: string): McpChatTool | undefined => {
      return chatTools.find((t) => t.displayName === displayName);
    },
    [chatTools],
  );

  const toolDefinitions = useMemo(
    () =>
      chatTools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.displayName,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
    [chatTools],
  );

  return {
    chatTools,
    toolDefinitions,
    resolveTool,
    ready: chatTools.length > 0,
    loaded,
    serverCount: serverIds.filter((id) => isMcpServerAllowed(allowed, id)).length,
    refresh: loadServers,
  };
}
