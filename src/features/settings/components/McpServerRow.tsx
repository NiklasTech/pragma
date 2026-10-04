"use client";

import { Button } from "@/shared/components/ui/button";
import type { McpServerConfig } from "@/shared/stores/settings";
import { PencilSimple, Trash, Play, Stop, ArrowClockwise } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import type { McpServerStatus, McpTool } from "../hooks/useMcpServers";
import { LogButton } from "./McpServerLogSheet";
import { McpServerTools } from "./McpServerTools";
import { McpSignInButton } from "./McpSignInButton";

function statusColor(status: McpServerStatus): string {
  switch (status) {
    case "running":
      return "bg-status-success";
    case "starting":
      return "bg-status-warning";
    case "error":
      return "bg-status-error";
    case "stopped":
    default:
      return "bg-fg-subtle";
  }
}

function statusLabel(status: McpServerStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "starting":
      return "Starting";
    case "error":
      return "Error";
    case "stopped":
    default:
      return "Stopped";
  }
}

interface McpServerRowProps {
  server: McpServerConfig;
  status: McpServerStatus;
  tools: McpTool[];
  logCount: number;
  authRequired: boolean;
  missingSecrets: string[] | undefined;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onShowLogs: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function McpServerRow({
  server,
  status,
  tools,
  logCount,
  authRequired,
  missingSecrets,
  onStart,
  onStop,
  onRestart,
  onShowLogs,
  onEdit,
  onDelete,
}: McpServerRowProps) {
  const isRunning = status === "running" || status === "starting";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/30 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn("size-2 shrink-0 rounded-full", statusColor(status))}
          title={statusLabel(status)}
        />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-ui-sm font-medium text-fg-default">{server.name}</span>
            <span className="text-ui-xs text-fg-subtle">{statusLabel(status)}</span>
            {server.autostart && (
              <span className="rounded-full border border-border/30 px-1.5 py-0.5 text-ui-xs text-fg-muted">
                autostart
              </span>
            )}
            {missingSecrets && (
              <span
                className="rounded-full border border-status-warning/40 px-1.5 py-0.5 text-ui-xs text-status-warning"
                title={`Edit the server to enter ${missingSecrets.join(", ")}`}
              >
                missing secrets
              </span>
            )}
          </div>
          <code className="truncate text-ui-xs text-fg-muted">
            {server.transport === "http"
              ? server.url
              : `${server.command} ${server.args.join(" ")}`}
          </code>
          <McpServerTools tools={tools} />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {server.transport === "http" && (
          <McpSignInButton
            serverId={server.id}
            serverName={server.name}
            authRequired={authRequired}
          />
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={isRunning ? onStop : onStart}
          title={isRunning ? "Stop server" : "Start server"}
          disabled={status === "starting"}
        >
          {isRunning ? <Stop size={14} /> : <Play size={14} />}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRestart}
          title="Restart server"
          disabled={status === "starting"}
        >
          <ArrowClockwise size={14} />
        </Button>
        <LogButton onClick={onShowLogs} logCount={logCount} />
        <Button variant="ghost" size="icon-xs" onClick={onEdit} title="Edit server">
          <PencilSimple size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          title="Delete server"
          className="text-fg-muted hover:text-status-error"
        >
          <Trash size={14} />
        </Button>
      </div>
    </div>
  );
}
