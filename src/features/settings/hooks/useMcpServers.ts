"use client";

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { McpServerConfig } from "@/shared/stores/settings";
import { unlistenQuietly } from "@/shared/lib/unlisten";

export type McpServerStatus = "stopped" | "starting" | "running" | "error";

/** Mirrors `McpServerState` in `src-tauri/src/modules/mcp/manager.rs`. */
export interface McpServerState {
  config: McpServerConfig;
  status: McpServerStatus;
  /** Why the last start failed; kept until the next start. */
  error?: string;
  authRequired: boolean;
  /** The last lines of the server's log, kept by the backend. */
  log: { timestamp: string; line: string }[];
}

export interface McpStatusChangedEvent {
  server_id: string;
  status: McpServerStatus;
  error?: string;
  /** The remote server answered that it needs an OAuth sign-in. */
  auth_required?: boolean;
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

function recordsEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((k) => a[k] === b[k]);
}

function toolsEqual(a: Record<string, McpTool[]>, b: Record<string, McpTool[]>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useMcpServers() {
  const [statuses, setStatuses] = useState<Record<string, McpServerStatus>>({});
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [logs, setLogs] = useState<Record<string, McpLogEvent[]>>({});
  const [authRequired, setAuthRequired] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await invoke<McpServerState[]>("mcp_list_servers");
      const next: Record<string, McpServerStatus> = {};
      const nextAuth: Record<string, boolean> = {};
      const nextErrors: Record<string, string> = {};
      for (const server of result) {
        next[server.config.id] = server.status;
        nextAuth[server.config.id] = server.authRequired;
        if (server.error) nextErrors[server.config.id] = server.error;
      }
      setStatuses((prev) => (statusesEqual(prev, next) ? prev : next));
      setAuthRequired((prev) => (recordsEqual(prev, nextAuth) ? prev : nextAuth));
      setErrors((prev) => (recordsEqual(prev, nextErrors) ? prev : nextErrors));
      // The backend keeps starts, failures and lines from before this view opened; take its
      // tail while it holds more than the events that arrived here.
      setLogs((prev) => {
        let changed = false;
        const seeded = { ...prev };
        for (const server of result) {
          const id = server.config.id;
          if (server.log.length <= (prev[id]?.length ?? 0)) continue;
          seeded[id] = server.log.map((entry) => ({ server_id: id, ...entry }));
          changed = true;
        }
        return changed ? seeded : prev;
      });
    } catch {}
  }, []);

  const loadTools = useCallback(async () => {
    const serverIds = Object.keys(statuses);
    if (serverIds.length === 0) return;

    const next: Record<string, McpTool[]> = {};
    for (const id of serverIds) {
      try {
        const result = await invoke<McpTool[]>("mcp_list_tools", { id });
        next[id] = result;
      } catch {}
    }
    setTools((prev) => (toolsEqual(prev, next) ? prev : next));
  }, [statuses]);

  const startServer = useCallback(async (id: string) => {
    try {
      await invoke("mcp_start_server", { id });
    } catch {}
  }, []);

  const stopServer = useCallback(async (id: string) => {
    try {
      await invoke("mcp_stop_server", { id });
    } catch {}
  }, []);

  const restartServer = useCallback(async (id: string) => {
    try {
      await invoke("mcp_restart_server", { id });
    } catch {}
  }, []);

  const loadServerTools = useCallback(async (id: string) => {
    try {
      const result = await invoke<McpTool[]>("mcp_list_tools", { id });
      setTools((prev) => ({ ...prev, [id]: result }));
    } catch {}
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
        const { server_id, status, error } = event.payload;
        setStatuses((prev) => ({ ...prev, [server_id]: status }));
        setAuthRequired((prev) => ({
          ...prev,
          [server_id]: event.payload.auth_required ?? false,
        }));
        setErrors((prev) => {
          const { [server_id]: _old, ...rest } = prev;
          return status === "error" ? { ...rest, [server_id]: error ?? "failed" } : rest;
        });
        if (status === "running") void loadServerTools(server_id);
      });
      if (!active) {
        void unlistenQuietly(unlistenStatus);
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
        void unlistenQuietly(unlistenNotification);
        unlistenNotification = undefined;
      }
    })();

    return () => {
      active = false;
      clearInterval(interval);
      void unlistenQuietly(unlistenStatus);
      void unlistenQuietly(unlistenLog);
      void unlistenQuietly(unlistenNotification);
    };
  }, [load, loadServerTools]);

  useEffect(() => {
    if (Object.keys(statuses).length === 0) return;
    if (Object.keys(tools).length > 0) return;
    void loadTools();
  }, [statuses, tools, loadTools]);

  return {
    statuses,
    tools,
    logs,
    authRequired,
    errors,
    loading,
    load,
    loadTools,
    startServer,
    stopServer,
    restartServer,
    clearLogs,
  };
}
