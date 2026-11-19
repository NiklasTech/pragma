"use client";

import { useEffect } from "react";
import { TerminalWindow } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { refreshCLIStatuses } from "@/shared/stores/ai/cliRefresh";

import { providerAccentById } from "../panes/providerAccent";
import { ProviderLogo } from "../panes/ProviderLogo";
import { buildSessionMenuCliRows } from "../threads/session-menu";
import { useNewSessionActions } from "../threads/useNewSessionActions";

interface CliQuickStartProps {
  rootPath: string;
  targetLeafId?: string;
}

/// One-click entry into a shell and the coding CLIs installed on this machine.
export function CliQuickStart({ rootPath, targetLeafId }: CliQuickStartProps) {
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const actions = useNewSessionActions(rootPath, targetLeafId);

  useEffect(() => {
    if (manifests.length === 0) void loadCLIManifests();
  }, [loadCLIManifests, manifests.length]);

  useEffect(() => {
    void refreshCLIStatuses();
  }, []);

  const available = buildSessionMenuCliRows(manifests, statuses).filter(
    (row) => !row.disabled && row.items.some((item) => item.action === "terminal"),
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-ui-xs text-fg-subtle">
        {available.length > 0 ? "Or open a shell or coding CLI" : "Or open a shell"}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void actions.startShell()}
        className="gap-1.5 rounded-full px-3 text-fg-muted hover:text-fg-default"
      >
        <TerminalWindow size={13} />
        Shell
      </Button>
      {available.map((row) => (
        <Button
          variant="secondary"
          size="sm"
          key={row.manifestId}
          onClick={() => {
            const manifest = manifests.find((item) => item.id === row.manifestId);
            if (manifest) void actions.startTerminal(manifest);
          }}
          className="group gap-1.5 rounded-full px-3 text-fg-muted hover:text-fg-default"
        >
          <ProviderLogo
            providerId={row.manifestId}
            name={row.name}
            size={13}
            className={cn(
              providerAccentById(row.manifestId).text,
              "transition-transform group-hover:scale-110",
            )}
          />
          {row.name}
        </Button>
      ))}
    </div>
  );
}
