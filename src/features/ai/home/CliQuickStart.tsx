"use client";

import { useEffect } from "react";
import { TerminalWindow } from "@phosphor-icons/react";

import { useAIStore } from "@/shared/stores/ai";

import { buildSessionMenuCliRows } from "../threads/session-menu";
import { useNewSessionActions } from "../threads/useNewSessionActions";

interface CliQuickStartProps {
  rootPath: string;
}

/// One-click entry into the coding CLIs installed on this machine.
export function CliQuickStart({ rootPath }: CliQuickStartProps) {
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const loadCLIStatuses = useAIStore((state) => state.loadCLIStatuses);
  const actions = useNewSessionActions(rootPath);

  useEffect(() => {
    if (manifests.length === 0) void loadCLIManifests();
    if (Object.keys(statuses).length === 0) void loadCLIStatuses();
  }, [loadCLIManifests, loadCLIStatuses, manifests.length, statuses]);

  const available = buildSessionMenuCliRows(manifests, statuses).filter(
    (row) => !row.disabled && row.items.some((item) => item.action === "terminal"),
  );

  if (available.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-ui-xs text-fg-subtle">Or open a coding CLI</span>
      {available.map((row) => (
        <button
          key={row.manifestId}
          type="button"
          onClick={() => {
            const manifest = manifests.find((item) => item.id === row.manifestId);
            if (manifest) void actions.startTerminal(manifest);
          }}
          className="flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-ui-xs font-medium text-fg-muted transition-colors hover:border-border hover:bg-bg-hover hover:text-fg-default"
        >
          <TerminalWindow size={13} className="shrink-0" />
          {row.name}
        </button>
      ))}
    </div>
  );
}
