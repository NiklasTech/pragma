import type { MouseEvent } from "react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { getIsMac } from "@/shared/lib/shortcuts";

import type { CliAgent } from "../home/agentTeam";
import { sameAgent, type QuickChoice } from "../quickStart/quickChoices";

const CHIP =
  "h-7 max-w-full min-w-0 gap-1.75 pr-2.25 pl-1.5 text-ui-sm font-normal aria-pressed:bg-bg-hover aria-pressed:text-fg-default";

interface AgentTeamPickerProps {
  choices: readonly QuickChoice[];
  pool: readonly CliAgent[];
  pragma: boolean;
  onPickOnly: (agent: CliAgent) => void;
  onToggle: (agent: CliAgent) => void;
  onPickPragma: () => void;
}

/// The agents a start hands its tasks to: a click picks one, ⌘-click adds another to share the tasks.
export function AgentTeamPicker({
  choices,
  pool,
  pragma,
  onPickOnly,
  onToggle,
  onPickPragma,
}: AgentTeamPickerProps) {
  const isMac = getIsMac();

  const click = (event: MouseEvent, agent: CliAgent) => {
    if (isMac ? event.metaKey : event.ctrlKey) onToggle(agent);
    else onPickOnly(agent);
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Agents">
      {choices.map((choice) => {
        const name = choice.accountLabel
          ? `${choice.manifest.name} ${choice.accountLabel}`
          : choice.manifest.name;
        const picked = !pragma && pool.some((agent) => sameAgent(agent, choice.agent));
        return (
          <Button
            key={`${choice.manifest.id}:${choice.agent.accountDir ?? ""}`}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={picked}
            title={`${isMac ? "⌘" : "Ctrl"}-click adds ${name}, so the tasks are shared`}
            onClick={(event) => click(event, choice.agent)}
            className={CHIP}
          >
            <AgentMark agentId={choice.manifest.id} name={choice.manifest.name} size="sm" />
            {choice.manifest.name}
            {choice.accountLabel && (
              <span className="min-w-0 truncate font-mono text-ui-2xs text-fg-subtle">
                {choice.accountLabel}
              </span>
            )}
          </Button>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={pragma}
        onClick={onPickPragma}
        className={CHIP}
      >
        <PragmaMark variant="compact" className="size-3.75" />
        Pragma
      </Button>
      {!pragma && choices.length > 1 && (
        <span className="px-1 font-mono text-ui-2xs text-fg-subtle">
          {isMac ? "⌘" : "Ctrl"} click shares the tasks
        </span>
      )}
    </div>
  );
}
