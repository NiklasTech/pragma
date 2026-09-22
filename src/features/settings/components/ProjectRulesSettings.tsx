"use client";

import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";
import { formatRulesSize } from "@/features/agent/rules";
import { PRAGMA_RULES_FILENAME } from "@/features/agent/rulesTemplate";
import { useAgentStore } from "@/features/agent/store";
import { useCreateRulesFile } from "@/features/agent/useCreateRulesFile";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

export function ProjectRulesSettings() {
  const useProjectRules = useSettingsStore((state) => state.agent.useProjectRules);
  const setAgentSettings = useSettingsStore((state) => state.setAgentSettings);
  const rules = useAgentStore((state) => state.rules);
  const { canCreate, creating, createRulesFile } = useCreateRulesFile();

  const status = !useProjectRules
    ? "Disabled"
    : rules
      ? `${rules.path} · ${formatRulesSize(rules.source.length)}${rules.truncated ? " (truncated)" : ""}`
      : "No rules file in this workspace";

  const createLabel =
    rules && rules.path !== PRAGMA_RULES_FILENAME
      ? `Create PRAGMA.md (replaces ${rules.path})`
      : "Create PRAGMA.md";

  return (
    <SettingSection title="Project Rules">
      <SettingRow
        label="Use PRAGMA.md"
        description="Send the project rules file with every chat and agent message"
        control={
          <Switch
            checked={useProjectRules}
            onCheckedChange={(value) => setAgentSettings({ useProjectRules: value })}
          />
        }
      />
      <div className="flex flex-col items-start gap-2 py-3">
        <span className="text-ui-xs text-fg-muted">{status}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void createRulesFile()}
          disabled={!canCreate || creating}
        >
          {createLabel}
        </Button>
        <span className="text-ui-2xs text-fg-subtle">
          PRAGMA.md takes precedence over AGENTS.md and CLAUDE.md.
        </span>
      </div>
    </SettingSection>
  );
}
