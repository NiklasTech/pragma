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

const MAX_LOGS_PER_SERVER = 1000;

export function useMcpServers() {
  const [statuses, setStatuses] = useState<Record<string, McpServerStatus>>({});
  const [logs, setLogs] = useState<Record<string, McpLogEvent[]>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<McpServerState[]>("mcp_list_servers");
      const next: Record<string, McpServerStatus> = {};
      for (const server of result) {
        next[server.config.id] = server.status;
      }
      setStatuses(next);
    } catch (err) {
      console.error("[MCP] failed to list servers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    void load();

    let unlistenStatus: (() => void) | undefined;
    let unlistenLog: (() => void) | undefined;
    let unlistenNotification: (() => void) | undefined;

    void listen<McpStatusChangedEvent>("mcp_status_changed", (event) => {
      setStatuses((prev) => ({
        ...prev,
        [event.payload.server_id]: event.payload.status,
      }));
    }).then((unlisten) => {
      unlistenStatus = unlisten;
    });

    void listen<McpLogEvent>("mcp_log", (event) => {
      const { server_id, timestamp, line } = event.payload;
      setLogs((prev) => {
        const existing = prev[server_id] ?? [];
        const next = [...existing, { server_id, timestamp, line }];
        if (next.length > MAX_LOGS_PER_SERVER) {
          next.shift();
        }
        return { ...prev, [server_id]: next };
      });
    }).then((unlisten) => {
      unlistenLog = unlisten;
    });

    void listen<McpNotificationEvent>("mcp_notification", (event) => {
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
    }).then((unlisten) => {
      unlistenNotification = unlisten;
    });

    return () => {
      unlistenStatus?.();
      unlistenLog?.();
      unlistenNotification?.();
    };
  }, [load]);

  return {
    statuses,
    logs,
    loading,
    load,
    startServer,
    stopServer,
    restartServer,
    clearLogs,
  };
}
