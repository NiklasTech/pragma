"use client";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { Chip } from "@/shared/components/ui/chip";
import { cn } from "@/shared/lib/utils";
import type { McpServerConfig } from "@/shared/stores/settings";

import type { McpLogEvent, McpTool } from "../../hooks/useMcpServers";
import { McpSignInButton } from "../McpSignInButton";
import type { McpCli, McpCliInfo } from "./cliMcp";
import type { McpRowState } from "./mcpRowState";

const LOG_TAIL = 6;

function Label({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.06em] text-fg-subtle uppercase">
      {children}
    </span>
  );
}

function time(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface McpServerDetailsProps {
  id: string;
  server: McpServerConfig;
  state: McpRowState;
  tools: McpTool[];
  logs: McpLogEvent[];
  error: string | undefined;
  missingSecrets: string[] | undefined;
  usage: Partial<Record<McpCli, string>>;
  clis: McpCliInfo[];
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onShowLogs: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Writes the server into the user config of a CLI that does not list it yet. */
  onShare: (cli: McpCli) => void;
}

/// What an opened server row shows: why it waits or failed, its tools, the CLIs that list
/// it, and the actions that do not fit in the row.
export function McpServerDetails({
  id,
  server,
  state,
  tools,
  logs,
  error,
  missingSecrets,
  usage,
  clis,
  onStart,
  onStop,
  onRestart,
  onShowLogs,
  onEdit,
  onDelete,
  onShare,
}: McpServerDetailsProps) {
  const running = state.kind === "running" || state.kind === "starting";
  const tail = logs.slice(-LOG_TAIL);

  return (
    <div id={id} className="flex flex-col gap-2.5 pt-0.5 pb-3.5 pl-[22px] text-[12.5px]">
      {state.kind === "sign-in" && (missingSecrets?.length ?? 0) === 0 && (
        <p className="leading-relaxed text-fg-muted">
          <span className="font-medium text-fg-default">{server.name} wants you to sign in.</span>{" "}
          Pragma opens your browser and keeps the token in the system keychain, never in a config
          file.
        </p>
      )}
      {(missingSecrets?.length ?? 0) > 0 && (
        <p className="leading-relaxed text-fg-muted">
          <span className="font-medium text-fg-default">
            {missingSecrets?.join(", ")} {missingSecrets?.length === 1 ? "has" : "have"} no value
            yet.
          </span>{" "}
          Enter {missingSecrets?.length === 1 ? "it" : "them"} under edit; the values go to the
          system keychain.
        </p>
      )}

      {state.kind === "failed" && tail.length > 0 && (
        <div className="rounded-[5px] bg-bg-well px-3 py-2 font-mono text-[11px] leading-[1.75] ring-1 ring-border-subtle ring-inset">
          {tail.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="flex min-w-0 gap-2.5">
              <span className="shrink-0 text-fg-subtle tabular-nums">{time(entry.timestamp)}</span>
              <span
                className={cn(
                  "min-w-0 break-words",
                  entry.line === error || index === tail.length - 1
                    ? "text-status-error"
                    : "text-fg-muted",
                )}
              >
                {entry.line}
              </span>
            </div>
          ))}
        </div>
      )}

      <Label>tools</Label>
      {tools.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <Chip key={tool.name} title={tool.description} className="font-mono text-[10.5px]">
              {tool.name}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-fg-subtle">
          {running ? "The server lists no tools." : "Start the server to see its tools."}
        </p>
      )}

      {clis.length > 0 && (
        <>
          <Label>used by</Label>
          <div className="flex flex-wrap gap-2">
            {clis.map((cli) => {
              const source = usage[cli.cli];
              const mark = (
                <AgentMark
                  agentId={cli.manifestId}
                  name={cli.name}
                  size="sm"
                  className={cn(
                    !source && "bg-transparent text-fg-subtle ring-1 ring-fg-default/15 ring-inset",
                  )}
                />
              );
              return source ? (
                <span
                  key={cli.cli}
                  title={source}
                  className="inline-flex h-7 max-w-full min-w-0 items-center gap-2 rounded-[5px] pr-2.5 pl-1.5 font-mono text-[11px] text-fg-default ring-1 ring-fg-default/15 ring-inset"
                >
                  {mark}
                  <span className="shrink-0">{cli.name}</span>
                  <span className="max-w-64 truncate text-[10.5px] text-fg-subtle">{source}</span>
                </span>
              ) : (
                <Button
                  key={cli.cli}
                  variant="ghost"
                  onClick={() => onShare(cli.cli)}
                  className="h-7 gap-2 pr-2.5 pl-1.5 text-[11px] font-normal text-fg-muted ring-1 ring-border-subtle ring-inset"
                >
                  {mark}
                  {cli.name}
                  <span className="text-[10.5px] text-state-needs-you">+ share</span>
                </Button>
              );
            })}
          </div>
          {clis.some((cli) => !usage[cli.cli]) && (
            <p className="text-fg-subtle">
              Sharing writes the server into that CLI&apos;s own user config. Agents it starts after
              that can use it.
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {running ? (
          <Button variant="outline" size="xs" onClick={onStop}>
            stop
          </Button>
        ) : (
          <Button variant="outline" size="xs" onClick={onStart}>
            start
          </Button>
        )}
        <Button variant="outline" size="xs" onClick={onRestart}>
          restart
        </Button>
        <Button variant="outline" size="xs" onClick={onEdit}>
          edit
        </Button>
        <Button variant="outline" size="xs" onClick={onShowLogs}>
          full log
        </Button>
        {server.transport === "http" && state.kind !== "sign-in" && (
          <McpSignInButton serverId={server.id} serverName={server.name} authRequired={false} />
        )}
        <Button variant="destructive" size="xs" onClick={onDelete} className="ml-auto">
          delete
        </Button>
      </div>
    </div>
  );
}
