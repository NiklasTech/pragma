"use client";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Checkbox } from "@/shared/components/ui/checkbox";

import { MCP_CLIS, type McpImportCandidate } from "./cliMcp";

interface McpImportListProps {
  candidates: McpImportCandidate[];
  selected: Set<McpImportCandidate>;
  onChange: (selected: Set<McpImportCandidate>) => void;
}

function describe({ server }: McpImportCandidate): string {
  return server.transport === "http"
    ? (server.url ?? "")
    : [server.command, ...server.args].join(" ");
}

/// Found servers to pick for import: name, the file and CLI they come from, their command.
export function McpImportList({ candidates, selected, onChange }: McpImportListProps) {
  const toggle = (candidate: McpImportCandidate, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(candidate);
    else next.delete(candidate);
    onChange(next);
  };

  return (
    <div className="flex flex-col">
      {candidates.map((candidate) => {
        const cli = MCP_CLIS.find((info) => info.cli === candidate.cli);
        return (
          <label
            key={`${candidate.source}:${candidate.server.name}`}
            className="grid min-h-9 cursor-pointer grid-cols-[14px_minmax(0,9rem)_minmax(0,1fr)_minmax(0,9.5rem)] items-center gap-3 border-t border-border-subtle py-1.5 font-mono text-ui-xs select-none first:border-t-0"
          >
            <Checkbox
              checked={selected.has(candidate)}
              onCheckedChange={(checked) => toggle(candidate, checked)}
            />
            <span className="truncate text-fg-default">{candidate.server.name}</span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-fg-muted">{candidate.source}</span>
              <span className="truncate text-[10.5px] text-fg-subtle">{describe(candidate)}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-fg-muted">
              {cli ? (
                <>
                  <AgentMark agentId={cli.manifestId} name={cli.name} size="sm" />
                  <span className="truncate">{cli.name}</span>
                </>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
