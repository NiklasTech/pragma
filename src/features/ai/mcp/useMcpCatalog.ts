import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useActiveSessionMeta } from "@/shared/hooks/useActiveSessionMeta";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";

import { isMcpServerAllowed, mcpSelectionKey, resolveMcpServerIds } from "./selection";
import { useMcpServerList } from "./useMcpServerList";

export interface McpCatalogEntry<T> {
  serverId: string;
  serverName: string;
  item: T;
}

type CatalogKind = "resources" | "prompts";

const COMMANDS: Record<CatalogKind, string> = {
  resources: "mcp_list_resources",
  prompts: "mcp_list_prompts",
};

/// The MCP server selection of the active chat session.
export function useActiveMcpSelection(): string[] | null {
  const session = useActiveSessionMeta();
  const agent = useNamedAgentsStore((state) =>
    session?.agentId ? state.agents.find((item) => item.id === session.agentId) : undefined,
  );
  const key = mcpSelectionKey(resolveMcpServerIds(session, agent));
  return useMemo(() => (key === "*" ? null : key.split("\n").filter(Boolean)), [key]);
}

/// Resources or prompts of the running servers the active session may use.
export function useMcpCatalog<T>(kind: CatalogKind): McpCatalogEntry<T>[] {
  const servers = useMcpServerList();
  const allowed = useActiveMcpSelection();
  const [entries, setEntries] = useState<McpCatalogEntry<T>[]>([]);
  const [revision, setRevision] = useState(0);

  const running = useMemo(
    () =>
      servers.filter(
        (server) => server.status === "running" && isMcpServerAllowed(allowed, server.id),
      ),
    [servers, allowed],
  );

  useEffect(() => {
    let active = true;
    void Promise.all(
      running.map(async (server) => {
        try {
          const items = await invoke<T[]>(COMMANDS[kind], { id: server.id });
          return items.map((item) => ({ serverId: server.id, serverName: server.name, item }));
        } catch {
          return [];
        }
      }),
    ).then((lists) => {
      if (active) setEntries(lists.flat());
    });
    return () => {
      active = false;
    };
  }, [kind, running, revision]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    void (async () => {
      unlisten = await listen<{ kind: string }>("mcp_list_changed", (event) => {
        if (event.payload.kind === kind) setRevision((value) => value + 1);
      });
      if (!active) {
        void unlistenQuietly(unlisten);
        unlisten = undefined;
      }
    })();
    return () => {
      active = false;
      void unlistenQuietly(unlisten);
    };
  }, [kind]);

  return entries;
}
