import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";

export type McpServerRunStatus = "stopped" | "starting" | "running" | "error";

export interface McpServerSummary {
  id: string;
  name: string;
  status: McpServerRunStatus;
}

interface McpServerStateResponse {
  config: { id: string; name: string };
  status: McpServerRunStatus;
}

/// Configured MCP servers with their status, kept current through status events.
export function useMcpServerList(): McpServerSummary[] {
  const [servers, setServers] = useState<McpServerSummary[]>([]);

  const load = useCallback(async () => {
    try {
      const result = await invoke<McpServerStateResponse[]>("mcp_list_servers");
      setServers(
        result.map((server) => ({
          id: server.config.id,
          name: server.config.name,
          status: server.status,
        })),
      );
    } catch {}
  }, []);

  useEffect(() => {
    void load();
    let unlisten: (() => void) | undefined;
    let active = true;
    void (async () => {
      unlisten = await listen("mcp_status_changed", () => void load());
      if (!active) {
        void unlistenQuietly(unlisten);
        unlisten = undefined;
      }
    })();
    return () => {
      active = false;
      void unlistenQuietly(unlisten);
    };
  }, [load]);

  return servers;
}
