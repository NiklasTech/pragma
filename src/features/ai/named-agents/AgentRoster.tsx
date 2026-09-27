"use client";

import { Plus, Robot } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import type { AgentStatus } from "@/features/agent/store";

import { engineLabel } from "./AgentEnginePicker";
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
      <button
        type="button"
        onClick={onNewAgent}
        className="flex h-8 w-full items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3.5 text-ui-sm text-fg-default transition-colors hover:bg-bg-hover"
      >
        <Plus size={14} weight="bold" />
        New agent
      </button>

      <div className="flex flex-col gap-0.5 pt-1">
        {agents.map((agent) => {
          const isActive = agent.id === selectedAgentId;
          const isRunning = agentHasActiveChat(agent, chatSessions, agentStatus, runSessionId);
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
                  "relative flex size-7 shrink-0 items-center justify-center rounded-md",
                  isActive ? "bg-accent-subtle text-primary" : "bg-bg-hover text-fg-muted",
                )}
              >
                <Robot size={14} weight={isActive ? "fill" : "regular"} />
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
