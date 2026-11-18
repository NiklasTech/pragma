"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";

import { newCandidates, type McpImportCandidate } from "./cliMcp";
import { importMcpCandidates } from "./mcpImport";
import { McpImportList } from "./McpImportList";

interface McpEmptyImportProps {
  candidates: McpImportCandidate[];
  loaded: boolean;
  onImported: () => void;
}

/// With no servers in Pragma yet, the ones the coding CLIs already know, ready to import.
export function McpEmptyImport({ candidates, loaded, onImported }: McpEmptyImportProps) {
  const found = React.useMemo(() => newCandidates(candidates, []), [candidates]);
  const [selected, setSelected] = React.useState<Set<McpImportCandidate>>(new Set());
  const [importing, setImporting] = React.useState(false);

  React.useEffect(() => setSelected(new Set(found)), [found]);

  if (!loaded) {
    return <p className="py-3 text-[12.5px] text-fg-subtle">Looking at your coding CLIs...</p>;
  }

  if (found.length === 0) {
    return (
      <p className="py-3 text-[12.5px] leading-relaxed text-fg-muted">
        No MCP servers yet. Pragma looked in this folder and in the configs of Claude Code, Codex,
        Gemini CLI, Cursor and Claude Desktop. Add one by hand to give agents more tools.
      </p>
    );
  }

  const importSelected = async () => {
    setImporting(true);
    const picked = found.filter((candidate) => selected.has(candidate));
    const error = await importMcpCandidates(picked);
    setImporting(false);
    if (error) toast.error(error);
    onImported();
  };

  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-[12.5px] leading-relaxed text-fg-muted">
        <span className="font-medium text-fg-default">
          Your coding CLIs already know {found.length} {found.length === 1 ? "server" : "servers"}.
        </span>{" "}
        Import them to see whether they work and which tools they bring.
      </p>
      <div className="rounded-[6px] px-3 ring-1 ring-border-subtle ring-inset">
        <McpImportList candidates={found} selected={selected} onChange={setSelected} />
      </div>
      <div>
        <Button
          size="xs"
          disabled={selected.size === 0 || importing}
          onClick={() => void importSelected()}
        >
          import {selected.size}
        </Button>
      </div>
    </div>
  );
}
