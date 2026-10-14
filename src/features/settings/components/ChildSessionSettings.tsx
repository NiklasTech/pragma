"use client";

import { useShallow } from "zustand/react/shallow";

import { Input } from "@/shared/components/ui/input";
import { useSettingsStore } from "@/shared/stores/settings";
import { CHILD_SESSIONS_BOUNDS, SESSION_DEPTH_BOUNDS } from "@/features/ai/children/limits";

import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

function readBounded(raw: string, bounds: { min: number; max: number }): number | null {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) return null;
  return value;
}

export function ChildSessionSettings() {
  const { agent, setAgentSettings } = useSettingsStore(
    useShallow((s) => ({ agent: s.agent, setAgentSettings: s.setAgentSettings })),
  );

  return (
    <SettingSection title="Child sessions">
      <SettingRow
        label="Children per session"
        description={`Active children one session may start, ${CHILD_SESSIONS_BOUNDS.min} to ${CHILD_SESSIONS_BOUNDS.max}.`}
        control={
          <Input
            type="number"
            min={CHILD_SESSIONS_BOUNDS.min}
            max={CHILD_SESSIONS_BOUNDS.max}
            inputMode="numeric"
            value={agent.maxChildSessions}
            aria-label="Children per session"
            className="h-7 w-28 text-ui-sm"
            onChange={(event) => {
              const value = readBounded(event.target.value, CHILD_SESSIONS_BOUNDS);
              if (value !== null) setAgentSettings({ maxChildSessions: value });
            }}
          />
        }
      />
      <SettingRow
        label="Nesting depth"
        description={`Levels of a session, its children and their children, ${SESSION_DEPTH_BOUNDS.min} to ${SESSION_DEPTH_BOUNDS.max}.`}
        control={
          <Input
            type="number"
            min={SESSION_DEPTH_BOUNDS.min}
            max={SESSION_DEPTH_BOUNDS.max}
            inputMode="numeric"
            value={agent.maxSessionDepth}
            aria-label="Nesting depth"
            className="h-7 w-28 text-ui-sm"
            onChange={(event) => {
              const value = readBounded(event.target.value, SESSION_DEPTH_BOUNDS);
              if (value !== null) setAgentSettings({ maxSessionDepth: value });
            }}
          />
        }
      />
    </SettingSection>
  );
}
