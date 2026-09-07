import { FileText } from "@phosphor-icons/react";

import { useAgentStore } from "../store";

export function AgentRulesStatus() {
  const rules = useAgentStore((state) => state.rules);

  const text = rules
    ? `Rules: ${rules.path}${rules.truncated ? " (truncated)" : ""}`
    : "No project rules";

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-t border-border/40 px-3 py-1.5 text-ui-xs text-fg-subtle">
      <FileText size={12} className="shrink-0" />
      <span className="truncate" title={text}>
        {text}
      </span>
    </div>
  );
}
