"use client";

import * as React from "react";
import { CaretRight } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { McpServerConfig } from "@/shared/stores/settings";
import { STATE_CELL_CLASSES } from "@/shell/chrome/SessionMark";

import type { McpLogEvent, McpServerStatus, McpTool } from "../hooks/useMcpServers";
import { McpSignInButton } from "./McpSignInButton";
import type { McpCli, McpCliInfo } from "./tools/cliMcp";
import { McpServerDetails } from "./tools/McpServerDetails";
import { mcpRowState, type McpRowState } from "./tools/mcpRowState";

/** The grid every server row and the header above them share. */
export const MCP_ROW_GRID =
  "grid grid-cols-[10px_minmax(0,1fr)_8.5rem_2.5rem_minmax(4.5rem,auto)_minmax(6.5rem,auto)] items-center gap-3";

const WORD_CLASSES: Record<McpRowState["kind"], string> = {
  running: "text-fg-muted",
  starting: "text-status-info",
  "sign-in": "text-state-needs-you",
  failed: "text-status-error",
  stopped: "text-fg-subtle",
};

export function describeServer(server: McpServerConfig): string {
  return server.transport === "http"
    ? (server.url ?? "")
    : `${server.command} ${server.args.join(" ")}`.trim();
}

interface McpServerRowProps {
  server: McpServerConfig;
  status: McpServerStatus;
  tools: McpTool[];
  logs: McpLogEvent[];
  authRequired: boolean;
  /** Why the last start failed. */
  error: string | undefined;
  missingSecrets: string[] | undefined;
  /** The config file each CLI lists this server in. */
  usage: Partial<Record<McpCli, string>>;
  clis: McpCliInfo[];
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onShowLogs: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: (cli: McpCli) => void;
}

/// One server as a D row: state cell, name, state in words, tool count, the CLIs that list
/// it and its next action. Clicking the name opens its tools, log and sharing below.
export function McpServerRow(props: McpServerRowProps) {
  const { server, status, tools, logs, authRequired, error, missingSecrets, usage, clis } = props;
  const [open, setOpen] = React.useState(false);
  const state = mcpRowState(status, authRequired, (missingSecrets?.length ?? 0) > 0);
  const detailsId = `mcp-details-${server.id}`;
  const sub = state.kind === "failed" && error ? error : describeServer(server);

  return (
    <div
      className={cn(
        "border-t border-border-subtle first:border-t-0",
        open && "-mx-2.5 rounded-[6px] border-t-transparent bg-fg-default/[0.035] px-2.5",
      )}
    >
      <div className={cn(MCP_ROW_GRID, "min-h-11")}>
        <span
          aria-hidden="true"
          className={cn(
            "size-2 justify-self-center rounded-[1.5px]",
            state.cell === "failed" ? "bg-status-error" : STATE_CELL_CLASSES[state.cell],
          )}
        />
        <Button
          variant="ghost"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
          className="h-auto min-w-0 flex-col items-start gap-0.5 px-0 py-1.5 text-left font-normal hover:bg-transparent aria-expanded:bg-transparent"
        >
          <span className="flex max-w-full items-center gap-1.5 text-[12.5px] font-medium text-fg-default">
            <span className="truncate">{server.name}</span>
            <CaretRight
              size={10}
              aria-hidden="true"
              className={cn(
                "shrink-0 text-fg-subtle transition-transform duration-(--motion-fast) motion-reduce:transition-none",
                open && "rotate-90",
              )}
            />
          </span>
          <span
            className={cn(
              "max-w-full truncate text-[11px]",
              state.kind === "failed" && error ? "text-status-error" : "text-fg-subtle",
            )}
          >
            {sub}
          </span>
        </Button>
        <span className={cn("truncate font-mono text-[11.5px]", WORD_CLASSES[state.kind])}>
          {state.word}
        </span>
        <span
          className={cn(
            "text-right font-mono text-[11.5px] tabular-nums",
            tools.length > 0 ? "text-fg-muted" : "text-fg-subtle",
          )}
        >
          {tools.length > 0 ? tools.length : "–"}
        </span>
        <span className="flex items-center gap-1">
          {clis.map((cli) => (
            <AgentMark
              key={cli.cli}
              agentId={cli.manifestId}
              name={usage[cli.cli] ? `${cli.name} uses it` : `${cli.name} does not list it`}
              size="md"
              className={cn(
                !usage[cli.cli] &&
                  "bg-transparent font-medium text-fg-subtle ring-1 ring-fg-default/15 ring-inset",
              )}
            />
          ))}
        </span>
        <span className="flex items-center justify-end gap-1.5">
          {logs.length > 0 && (
            <Button variant="outline" size="xs" onClick={props.onShowLogs}>
              log {logs.length > 99 ? "99+" : logs.length}
            </Button>
          )}
          <RowAction {...props} state={state} />
        </span>
      </div>
      {open && (
        <McpServerDetails
          id={detailsId}
          server={server}
          state={state}
          tools={tools}
          logs={logs}
          error={error}
          missingSecrets={missingSecrets}
          usage={usage}
          clis={clis}
          onStart={props.onStart}
          onStop={props.onStop}
          onRestart={props.onRestart}
          onShowLogs={props.onShowLogs}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
          onShare={props.onShare}
        />
      )}
    </div>
  );
}

function RowAction({
  server,
  authRequired,
  state,
  onStart,
  onStop,
  onRestart,
  onEdit,
}: McpServerRowProps & { state: McpRowState }) {
  if (authRequired && server.transport === "http") {
    return <McpSignInButton serverId={server.id} serverName={server.name} authRequired />;
  }
  switch (state.kind) {
    case "running":
      return (
        <Button variant="outline" size="xs" onClick={onStop}>
          stop
        </Button>
      );
    case "starting":
      return null;
    case "failed":
      return (
        <Button variant="outline" size="xs" onClick={onRestart}>
          restart
        </Button>
      );
    case "sign-in":
      return (
        <Button size="xs" onClick={onEdit}>
          edit
        </Button>
      );
    case "stopped":
      return (
        <Button variant="outline" size="xs" onClick={onStart}>
          start
        </Button>
      );
  }
}
