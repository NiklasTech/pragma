"use client";

import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { useSettingsStore, type AgentView } from "@/shared/stores/settings";
import { AGENT_VIEW_LABELS } from "@/features/ai/panes/agentView";

import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const VIEWS: AgentView[] = ["terminal", "chat"];

/** Whether new agents open in the CLI's terminal or in Pragma's chat. */
export function AgentViewSettings() {
  const view = useSettingsStore((state) => state.agent.view);
  const setAgentSettings = useSettingsStore((state) => state.setAgentSettings);

  return (
    <SettingSection title="How agents open">
      <SettingRow
        label="Show agents as"
        description="The default for New, the start card and empty panes, where you can pick the other one for a single start. Terminals fit beside both."
        control={
          <SegmentedControl<AgentView>
            label="Show agents as"
            value={view}
            onValueChange={(next) => setAgentSettings({ view: next })}
            options={VIEWS.map((value) => ({ value, label: AGENT_VIEW_LABELS[value] }))}
          />
        }
      />
    </SettingSection>
  );
}
