"use client";

import { Checkbox } from "@/shared/components/ui/checkbox";
import { useMcpServerList } from "@/features/ai/mcp/useMcpServerList";

interface AgentMcpServersFieldProps {
  /** Undefined means all configured servers. */
  value: string[] | undefined;
  onChange: (value: string[] | undefined) => void;
}

export function AgentMcpServersField({ value, onChange }: AgentMcpServersFieldProps) {
  const servers = useMcpServerList();

  if (servers.length === 0) {
    return (
      <p className="p-4 text-ui-xs text-fg-subtle">
        No MCP servers are configured. Add them in Settings &gt; MCP.
      </p>
    );
  }

  const toggle = (serverId: string, enabled: boolean) => {
    const current = value ?? servers.map((server) => server.id);
    onChange(enabled ? [...current, serverId] : current.filter((id) => id !== serverId));
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      <label className="flex cursor-pointer items-center gap-2 text-ui-xs text-fg-muted select-none">
        <Checkbox
          checked={value === undefined}
          onCheckedChange={(checked) =>
            onChange(checked ? undefined : servers.map((server) => server.id))
          }
        />
        All servers, including ones added later
      </label>
      {value !== undefined &&
        servers.map((server) => (
          <label
            key={server.id}
            className="flex cursor-pointer items-center gap-2 pl-5 text-ui-xs text-fg-default select-none"
          >
            <Checkbox
              checked={value.includes(server.id)}
              onCheckedChange={(checked) => toggle(server.id, checked)}
            />
            <span className="min-w-0 truncate">{server.name}</span>
          </label>
        ))}
    </div>
  );
}
