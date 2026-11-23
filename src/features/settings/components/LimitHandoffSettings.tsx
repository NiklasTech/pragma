"use client";

import { useShallow } from "zustand/react/shallow";

import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useSettingsStore, type AgentLimitHandoff } from "@/shared/stores/settings";

import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const LIMIT_OPTIONS: Array<{ value: AgentLimitHandoff; label: string }> = [
  { value: "ask", label: "Ask me" },
  { value: "switch", label: "Switch accounts on its own" },
  { value: "off", label: "Do nothing" },
];

export const LIMIT_THRESHOLD_BOUNDS = { min: 50, max: 99 };

function isLimitHandoff(value: unknown): value is AgentLimitHandoff {
  return LIMIT_OPTIONS.some((option) => option.value === value);
}

/** What Pragma does when a coding CLI account nears or hits its usage limit. */
export function LimitHandoffSettings() {
  const { agent, setAgentSettings } = useSettingsStore(
    useShallow((s) => ({ agent: s.agent, setAgentSettings: s.setAgentSettings })),
  );

  return (
    <SettingSection title="Usage limit">
      <SettingRow
        label="Near the limit"
        description="Ask offers another account or waiting for the reset in the agent's pane. Switch on its own moves a Claude Code session to the account with the most room once it hits its limit."
        control={
          <Select
            value={agent.limitHandoff}
            onValueChange={(value) => {
              if (isLimitHandoff(value)) setAgentSettings({ limitHandoff: value });
            }}
          >
            <SelectTrigger className="max-w-[240px]">
              <SelectValue>
                {LIMIT_OPTIONS.find((option) => option.value === agent.limitHandoff)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Usage limit from"
        description={`The share of a usage window, in percent, from which panes show the usage and ask, ${LIMIT_THRESHOLD_BOUNDS.min} to ${LIMIT_THRESHOLD_BOUNDS.max}.`}
        control={
          <Input
            type="number"
            min={LIMIT_THRESHOLD_BOUNDS.min}
            max={LIMIT_THRESHOLD_BOUNDS.max}
            inputMode="numeric"
            value={agent.limitThreshold}
            aria-label="Usage limit threshold in percent"
            className="h-7 w-28 text-ui-sm"
            onChange={(event) => {
              const value = Number(event.target.value.trim());
              if (
                Number.isInteger(value) &&
                value >= LIMIT_THRESHOLD_BOUNDS.min &&
                value <= LIMIT_THRESHOLD_BOUNDS.max
              ) {
                setAgentSettings({ limitThreshold: value });
              }
            }}
          />
        }
      />
    </SettingSection>
  );
}
