"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpServerState {
  config: { id: string; name: string };
  status: "stopped" | "starting" | "running" | "error";
}

export interface McpChatTool {
  serverId: string;
  toolName: string;
  displayName: string;
  description: string;
  parameters: unknown;
}

function toolDisplayName(serverId: string, toolName: string): string {
  return `${serverId}__${toolName}`;
}

export function useMcpChatTools() {
  const serversRef = useRef<Record<string, McpServerState["status"]>>({});
  const [serverCount, setServerCount] = useState(0);
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
      } catch (err) {
        console.error(`[MCP Chat] failed to list tools for ${id}:`, err);
      }
    }

    setToolsByServer((prev) => {
      const next: Record<string, McpTool[]> = {};
      for (const id of serverIds) {
        next[id] = fetched[id] ?? prev[id] ?? [];
      }
      return next;
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
      setServerCount(result.length);
      await fetchTools(next);
      setLoaded(true);
    } catch (err) {
      console.error("[MCP Chat] failed to list servers:", err);
    }
  }, [fetchTools]);

  useEffect(() => {
    void loadServers();
    const interval = setInterval(() => void loadServers(), 500);

    let unlisten: (() => void) | undefined;
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
      if (!active) {
        unlisten();
        unlisten = undefined;
      }
    })();

    return () => {
      active = false;
      clearInterval(interval);
      unlisten?.();
    };
  }, [loadServers, fetchTools]);

  const chatTools: McpChatTool[] = Object.entries(toolsByServer).flatMap(([serverId, tools]) =>
    tools.map((tool) => ({
      serverId,
      toolName: tool.name,
      displayName: toolDisplayName(serverId, tool.name),
      description: tool.description,
      parameters: tool.inputSchema ?? {},
    })),
  );

  const resolveTool = useCallback(
    (displayName: string): McpChatTool | undefined => {
      return chatTools.find((t) => t.displayName === displayName);
    },
    [chatTools],
  );

  const toolDefinitions = chatTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.displayName,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  return {
    chatTools,
    toolDefinitions,
    resolveTool,
    ready: chatTools.length > 0,
    loaded,
    serverCount,
    refresh: loadServers,
  };
}
