import { FileText, Plus } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { useSettingsStore } from "@/shared/stores/settings";
import { formatRulesSize } from "../rules";
import { useAgentStore } from "../store";
import { useCreateRulesFile } from "../useCreateRulesFile";

export function AgentRulesStatus() {
  const rules = useAgentStore((state) => state.rules);
  const useProjectRules = useSettingsStore((state) => state.agent.useProjectRules);
  const { canCreate, creating, createRulesFile } = useCreateRulesFile();

  const text = !useProjectRules
    ? "Rules: off"
    : rules
      ? `Rules: ${rules.path} · ${formatRulesSize(rules.source.length)}${rules.truncated ? " (truncated)" : ""}`
      : "No project rules";

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-t border-border/40 px-3 py-1.5 text-ui-xs text-fg-subtle">
      <FileText size={12} className="shrink-0" />
      <span className="truncate" title={text}>
        {text}
      </span>
      {useProjectRules && canCreate && (
        <Button
          size="xs"
          variant="ghost"
          className="ml-auto shrink-0"
          onClick={() => void createRulesFile()}
          disabled={creating}
          title="Create PRAGMA.md"
        >
          <Plus size={10} weight="bold" />
          Create PRAGMA.md
        </Button>
      )}
    </div>
  );
}
