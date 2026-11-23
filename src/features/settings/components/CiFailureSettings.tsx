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
import { useSettingsStore, type AgentCiFailure } from "@/shared/stores/settings";

import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const CI_FAILURE_OPTIONS: Array<{ value: AgentCiFailure; label: string }> = [
  { value: "ask", label: "Ask me" },
  { value: "fix", label: "Fix on its own" },
  { value: "off", label: "Do nothing" },
];

export const CI_FIX_TRIES_BOUNDS = { min: 1, max: 10 };

function isCiFailure(value: unknown): value is AgentCiFailure {
  return CI_FAILURE_OPTIONS.some((option) => option.value === value);
}

/** What Pragma does when CI fails on the pull request of an agent worktree. */
export function CiFailureSettings() {
  const { agent, setAgentSettings } = useSettingsStore(
    useShallow((s) => ({ agent: s.agent, setAgentSettings: s.setAgentSettings })),
  );

  return (
    <SettingSection title="CI on agent pull requests">
      <SettingRow
        label="When CI fails"
        description="Ask shows the failed checks in the agent's pane. Fix on its own sends them to the agent once all checks are done."
        control={
          <Select
            value={agent.ciFailure}
            onValueChange={(value) => {
              if (isCiFailure(value)) setAgentSettings({ ciFailure: value });
            }}
          >
            <SelectTrigger className="max-w-[220px]">
              <SelectValue>
                {CI_FAILURE_OPTIONS.find((option) => option.value === agent.ciFailure)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CI_FAILURE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        label="Tries before it asks"
        description={`Fixes Pragma sends on its own per pull request, ${CI_FIX_TRIES_BOUNDS.min} to ${CI_FIX_TRIES_BOUNDS.max}.`}
        control={
          <Input
            type="number"
            min={CI_FIX_TRIES_BOUNDS.min}
            max={CI_FIX_TRIES_BOUNDS.max}
            inputMode="numeric"
            value={agent.ciFixTries}
            disabled={agent.ciFailure !== "fix"}
            aria-label="Tries before it asks"
            className="h-7 w-28 text-ui-sm"
            onChange={(event) => {
              const value = Number(event.target.value.trim());
              if (
                Number.isInteger(value) &&
                value >= CI_FIX_TRIES_BOUNDS.min &&
                value <= CI_FIX_TRIES_BOUNDS.max
              ) {
                setAgentSettings({ ciFixTries: value });
              }
            }}
          />
        }
      />
    </SettingSection>
  );
}
