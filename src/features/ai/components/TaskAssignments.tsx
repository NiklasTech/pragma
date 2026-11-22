import { CaretDown, Check } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

import type { CliAgent } from "../home/agentTeam";
import { sameAgent, type QuickChoice } from "../quickStart/quickChoices";

interface TaskAssignmentsProps {
  tasks: readonly string[];
  agents: readonly CliAgent[];
  choices: readonly QuickChoice[];
  onAssign: (index: number, agent: CliAgent) => void;
}

/// Which agent runs which task of a start; each one can be handed to another agent or account.
export function TaskAssignments({ tasks, agents, choices, onAssign }: TaskAssignmentsProps) {
  const choiceOf = (agent: CliAgent | undefined) =>
    agent ? choices.find((choice) => sameAgent(choice.agent, agent)) : undefined;

  return (
    <ol
      className="flex flex-col border-t border-border-subtle pt-1.5"
      aria-label="Tasks of this start"
    >
      {tasks.map((task, index) => {
        const choice = choiceOf(agents[index]);
        return (
          <li key={index} className="flex min-w-0 items-center gap-2.5 py-0.5">
            <span className="w-4 shrink-0 text-right font-mono text-ui-2xs text-fg-subtle">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-ui-sm text-fg-muted" title={task}>
              {task}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Agent for task ${index + 1}: ${choice?.manifest.name ?? "none"}`}
                    className="h-6.5 max-w-[50%] min-w-0 shrink-0 gap-1.5 pr-1.5 pl-1.5 text-ui-xs font-normal"
                  />
                }
              >
                {choice && (
                  <AgentMark agentId={choice.manifest.id} name={choice.manifest.name} size="sm" />
                )}
                <span className="shrink-0">{choice?.manifest.name ?? "Pick an agent"}</span>
                {choice?.accountLabel && (
                  <span className="min-w-0 truncate font-mono text-ui-2xs text-fg-subtle">
                    {choice.accountLabel}
                  </span>
                )}
                <CaretDown size={10} className="shrink-0 text-fg-subtle" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {choices.map((option) => (
                  <DropdownMenuItem
                    key={`${option.manifest.id}:${option.agent.accountDir ?? ""}`}
                    onClick={() => onAssign(index, option.agent)}
                  >
                    <AgentMark agentId={option.manifest.id} name={option.manifest.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {option.manifest.name}
                      {option.accountLabel && (
                        <span className="ml-1.5 font-mono text-ui-2xs text-fg-subtle">
                          {option.accountLabel}
                        </span>
                      )}
                    </span>
                    {choice === option && <Check size={12} className="text-fg-muted" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        );
      })}
    </ol>
  );
}
