import { ListChecks } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { useAgentsUiStore } from "../store/agentsUi";

export function ContextPaneToggle() {
  const collapsed = useAgentsUiStore((state) => state.contextPaneCollapsed);
  const setCollapsed = useAgentsUiStore((state) => state.setContextPaneCollapsed);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setCollapsed(!collapsed)}
      aria-pressed={!collapsed}
      aria-label={collapsed ? "Expand context pane" : "Collapse context pane"}
      title="Review changes and context files"
      className={cn(
        "h-7 gap-1.5 rounded-full px-2.5",
        !collapsed && "bg-bg-active text-fg-default",
      )}
    >
      <ListChecks size={14} weight={collapsed ? "regular" : "bold"} />
      Review
    </Button>
  );
}
