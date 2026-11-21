import type { MouseEvent } from "react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { getIsMac } from "@/shared/lib/shortcuts";

import { memberCount, teamTotal, type TeamMember } from "../home/agentTeam";
import { MAX_PANES } from "../panes/operations";
import type { QuickChoice } from "../quickStart/quickChoices";
import { AgentCountStepper } from "./AgentCountStepper";

type CliAgent = QuickChoice["agent"];

const CHIP =
  "h-7 max-w-full min-w-0 gap-1.75 pr-2.25 pl-1.5 text-ui-sm font-normal aria-pressed:bg-bg-hover aria-pressed:text-fg-default";

interface AgentTeamPickerProps {
  choices: readonly QuickChoice[];
  team: readonly TeamMember[];
  pragma: boolean;
  onPickOnly: (agent: CliAgent) => void;
  onToggle: (agent: CliAgent) => void;
  onCount: (agent: CliAgent, count: number) => void;
  onPickPragma: () => void;
}

/// The agents a start runs: a click picks one, ⌘-click adds another, each with its own count.
export function AgentTeamPicker({
  choices,
  team,
  pragma,
  onPickOnly,
  onToggle,
  onCount,
  onPickPragma,
}: AgentTeamPickerProps) {
  const isMac = getIsMac();
  const total = teamTotal(team);

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
        const count = pragma ? null : memberCount(team, choice.agent);
        return (
          <span
            key={`${choice.manifest.id}:${choice.agent.accountDir ?? ""}`}
            className="flex max-w-full min-w-0 items-center gap-0.5"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={count !== null}
              title={`${isMac ? "⌘" : "Ctrl"}-click adds ${name} to the start`}
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
            {count !== null && (
              <AgentCountStepper
                count={count}
                label={name}
                max={MAX_PANES - (total - count)}
                removable={team.length > 1}
                onChange={(next) => onCount(choice.agent, next)}
              />
            )}
          </span>
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
          {isMac ? "⌘" : "Ctrl"} click adds an agent
        </span>
      )}
    </div>
  );
}
