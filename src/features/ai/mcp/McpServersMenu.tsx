"use client";

import { Plugs } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";

import { isMcpServerAllowed, resolveMcpServerIds } from "./selection";
import { useMcpServerList } from "./useMcpServerList";

/// Picks the MCP servers of the active session; without a choice it follows the agent or uses all.
export function McpServersMenu() {
  const servers = useMcpServerList();
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const session = useAIStore((state) =>
    state.chatSessions.find((item) => item.id === state.activeChatSessionId),
  );
  const agent = useNamedAgentsStore((state) =>
    session?.agentId ? state.agents.find((item) => item.id === session.agentId) : undefined,
  );

  if (!session || !rootPath || servers.length === 0) return null;

  const allowed = resolveMcpServerIds(session, agent);
  const enabledCount = servers.filter((server) => isMcpServerAllowed(allowed, server.id)).length;

  const save = (mcpServers: string[] | undefined) => {
    const next = { ...session, updatedAt: Date.now() };
    if (mcpServers) {
      next.mcpServers = mcpServers;
    } else {
      delete next.mcpServers;
    }
    void useAIStore.getState().updateChatSession(rootPath, next);
  };

  const toggle = (serverId: string, enabled: boolean) => {
    const current = servers
      .map((server) => server.id)
      .filter((id) => isMcpServerAllowed(allowed, id));
    save(enabled ? [...current, serverId] : current.filter((id) => id !== serverId));
  };

  const label = `MCP servers: ${enabledCount} of ${servers.length}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className="flex h-7 items-center gap-1 rounded-full px-2 text-ui-xs font-medium text-fg-muted transition-colors outline-none hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plugs size={13} weight="bold" className="shrink-0" />
            <span className="@max-[320px]:hidden">{enabledCount}</span>
          </button>
        }
      />
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-60">
        <DropdownMenuLabel>MCP servers for this session</DropdownMenuLabel>
        {servers.map((server) => (
          <DropdownMenuCheckboxItem
            key={server.id}
            checked={isMcpServerAllowed(allowed, server.id)}
            onCheckedChange={(checked) => toggle(server.id, checked)}
          >
            <span className="min-w-0 truncate">{server.name}</span>
            {server.status !== "running" && (
              <span className="ml-auto text-ui-2xs text-fg-subtle">{server.status}</span>
            )}
          </DropdownMenuCheckboxItem>
        ))}
        {session.mcpServers && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => save(undefined)}>
              {agent ? "Use the agent's servers" : "Use all servers"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
