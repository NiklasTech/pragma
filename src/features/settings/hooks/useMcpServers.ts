"use client";

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { McpServerConfig } from "@/shared/stores/settings";

export type McpServerStatus = "stopped" | "starting" | "running" | "error";

export interface McpServerState {
  config: McpServerConfig;
  status: McpServerStatus;
}

export interface McpStatusChangedEvent {
  server_id: string;
  status: McpServerStatus;
  error?: string;
}

export interface McpLogEvent {
  server_id: string;
  timestamp: string;
  line: string;
}

export interface McpNotificationEvent {
  server_id: string;
  method: string;
  params?: unknown;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

const MAX_LOGS_PER_SERVER = 1000;

function statusesEqual(
  a: Record<string, McpServerStatus>,
  b: Record<string, McpServerStatus>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

function toolsEqual(a: Record<string, McpTool[]>, b: Record<string, McpTool[]>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useMcpServers() {
  const [statuses, setStatuses] = useState<Record<string, McpServerStatus>>({});
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [logs, setLogs] = useState<Record<string, McpLogEvent[]>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await invoke<McpServerState[]>("mcp_list_servers");
      const next: Record<string, McpServerStatus> = {};
      for (const server of result) {
        next[server.config.id] = server.status;
      }
      setStatuses((prev) => (statusesEqual(prev, next) ? prev : next));
    } catch (err) {
      console.error("[MCP] failed to list servers:", err);
    }
  }, []);

  const loadTools = useCallback(async () => {
    const serverIds = Object.keys(statuses);
    if (serverIds.length === 0) return;

    const next: Record<string, McpTool[]> = {};
    for (const id of serverIds) {
      try {
        const result = await invoke<McpTool[]>("mcp_list_tools", { id });
        next[id] = result;
      } catch (err) {
        console.error(`[MCP] failed to list tools for ${id}:`, err);
      }
    }
    setTools((prev) => (toolsEqual(prev, next) ? prev : next));
  }, [statuses]);

  const startServer = useCallback(async (id: string) => {
    try {
      await invoke("mcp_start_server", { id });
    } catch (err) {
      console.error(`[MCP] failed to start server ${id}:`, err);
    }
  }, []);

  const stopServer = useCallback(async (id: string) => {
    try {
      await invoke("mcp_stop_server", { id });
    } catch (err) {
      console.error(`[MCP] failed to stop server ${id}:`, err);
    }
  }, []);

  const restartServer = useCallback(async (id: string) => {
    try {
      await invoke("mcp_restart_server", { id });
    } catch (err) {
      console.error(`[MCP] failed to restart server ${id}:`, err);
    }
  }, []);

  const clearLogs = useCallback((id: string) => {
    setLogs((prev) => ({ ...prev, [id]: [] }));
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));

    const interval = setInterval(() => void load(), 5000);

    let unlistenStatus: (() => void) | undefined;
    let unlistenLog: (() => void) | undefined;
    let unlistenNotification: (() => void) | undefined;
    let active = true;

    void (async () => {
      unlistenStatus = await listen<McpStatusChangedEvent>("mcp_status_changed", (event) => {
        setStatuses((prev) => ({
          ...prev,
          [event.payload.server_id]: event.payload.status,
        }));
      });
      if (!active) {
        unlistenStatus();
        unlistenStatus = undefined;
      }

      unlistenLog = await listen<McpLogEvent>("mcp_log", (event) => {
        const { server_id, timestamp, line } = event.payload;
        setLogs((prev) => {
          const existing = prev[server_id] ?? [];
          const next = [...existing, { server_id, timestamp, line }];
          if (next.length > MAX_LOGS_PER_SERVER) {
            next.shift();
          }
          return { ...prev, [server_id]: next };
        });
      });
      if (!active) {
        unlistenLog();
        unlistenLog = undefined;
      }

      unlistenNotification = await listen<McpNotificationEvent>("mcp_notification", (event) => {
        const { server_id, method, params } = event.payload;
        const line = params ? `${method}: ${JSON.stringify(params)}` : method;
        setLogs((prev) => {
          const existing = prev[server_id] ?? [];
          const next = [
            ...existing,
            {
              server_id,
              timestamp: new Date().toISOString(),
              line: `[notification] ${line}`,
            },
          ];
          if (next.length > MAX_LOGS_PER_SERVER) {
            next.shift();
          }
          return { ...prev, [server_id]: next };
        });
      });
      if (!active) {
        unlistenNotification();
        unlistenNotification = undefined;
      }
    })();

    return () => {
      active = false;
      clearInterval(interval);
      unlistenStatus?.();
      unlistenLog?.();
      unlistenNotification?.();
    };
  }, [load]);

  useEffect(() => {
    if (Object.keys(statuses).length === 0) return;
    if (Object.keys(tools).length > 0) return;
    void loadTools();
  }, [statuses, tools, loadTools]);

  return {
    statuses,
    tools,
    logs,
    loading,
    load,
    loadTools,
    startServer,
    stopServer,
    restartServer,
    clearLogs,
  };
}
