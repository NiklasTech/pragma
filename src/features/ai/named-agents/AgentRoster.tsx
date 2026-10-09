"use client";

import { DownloadSimple, Plus, Robot } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import type { AgentStatus } from "@/features/agent/store";

import { seededAccent } from "../panes/providerAccent";
import { engineLabel } from "./AgentEnginePicker";
import { importAgent } from "./transferActions";
import type { Agent } from "./types";

interface AgentRosterProps {
  agents: Agent[];
  selectedAgentId: string | null;
  chatSessions: ChatSession[];
  agentStatus: AgentStatus;
  runSessionId: string | null;
  onSelectAgent: (agentId: string) => void;
  onNewAgent: () => void;
}

function agentHasActiveChat(
  agent: Agent,
  chatSessions: ChatSession[],
  agentStatus: AgentStatus,
  runSessionId: string | null,
): boolean {
  if (agentStatus !== "running" && agentStatus !== "waiting-approval") return false;
  return chatSessions.some(
    (session) => session.agentId === agent.id && session.id === runSessionId,
  );
}

export function AgentRoster({
  agents,
  selectedAgentId,
  chatSessions,
  agentStatus,
  runSessionId,
  onSelectAgent,
  onNewAgent,
}: AgentRosterProps) {
  const cliManifests = useAIStore((state) => state.cliManifests);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          onClick={onNewAgent}
          className="h-8 min-w-0 flex-1 justify-start gap-2 rounded-full px-3.5 text-ui-sm shadow-[0_6px_18px_-10px_var(--color-accent-glow)]"
        >
          <Plus size={13} weight="bold" />
          New agent
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Import agent"
          title="Import agent"
          onClick={() => {
            void importAgent().then((agent) => {
              if (agent) onSelectAgent(agent.id);
            });
          }}
        >
          <DownloadSimple size={14} />
        </Button>
      </div>

      <div className="flex flex-col gap-0.5 pt-1">
        {agents.map((agent) => {
          const isActive = agent.id === selectedAgentId;
          const isRunning = agentHasActiveChat(agent, chatSessions, agentStatus, runSessionId);
          const accent = seededAccent(agent.id);
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelectAgent(agent.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg py-1.5 pr-2 pl-2 text-left transition-colors",
                isActive
                  ? "bg-bg-root shadow-[var(--shadow-sm)] ring-1 ring-border-subtle"
                  : "hover:bg-bg-hover",
              )}
            >
              <span
                className={cn(
                  "relative flex size-7 shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-105",
                  accent.soft,
                  accent.text,
                )}
              >
                <Robot size={14} weight="fill" />
                {isRunning && (
                  <span
                    className={cn(
                      "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-bg-chrome",
                      agentStatus === "waiting-approval"
                        ? "bg-status-warning"
                        : "animate-pulse bg-linear-to-r from-brand-from to-brand-to",
                    )}
                    title={agentStatus === "waiting-approval" ? "Waiting for approval" : "Running"}
                    aria-label={
                      agentStatus === "waiting-approval" ? "Waiting for approval" : "Running"
                    }
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "truncate text-ui-sm",
                    isActive
                      ? "font-medium text-fg-default"
                      : "text-fg-muted group-hover:text-fg-default",
                  )}
                  title={agent.name}
                >
                  {agent.name}
                </span>
                <span className="truncate text-ui-2xs text-fg-subtle">
                  {engineLabel(
                    agent.engine,
                    cliManifests.find((manifest) => manifest.id === agent.engine.cliProviderId)
                      ?.name ?? null,
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
