import { ListChecks } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

import { useAgentsUiStore } from "../store/agentsUi";

export function ContextPaneToggle() {
  const collapsed = useAgentsUiStore((state) => state.contextPaneCollapsed);
  const setCollapsed = useAgentsUiStore((state) => state.setContextPaneCollapsed);

  return (
    <button
      type="button"
      onClick={() => setCollapsed(!collapsed)}
      aria-pressed={!collapsed}
      aria-label={collapsed ? "Expand context pane" : "Collapse context pane"}
      title="Review changes and context files"
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-ui-xs font-medium transition-colors",
        collapsed
          ? "text-fg-muted hover:bg-bg-hover hover:text-fg-default"
          : "bg-accent-subtle text-primary",
      )}
    >
      <ListChecks size={14} weight={collapsed ? "regular" : "bold"} />
      Review
    </button>
  );
}
