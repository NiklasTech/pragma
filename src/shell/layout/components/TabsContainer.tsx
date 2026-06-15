import { cn } from "@/shared/lib/utils";
import type { PanelNode } from "../tree/types";
import { panelLabel } from "./panels/panelLabels";

interface TabsContainerProps {
  tabs: PanelNode[];
  activeTabId: string | null;
  onSelect: (panelId: string) => void;
  children: React.ReactNode;
}

export function TabsContainer({ tabs, activeTabId, onSelect, children }: TabsContainerProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-tab shrink-0 overflow-x-auto border-b border-border bg-bg-surface">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={cn(
              "flex shrink-0 items-center px-3 text-ui-xs transition-colors select-none",
              activeTabId === tab.id
                ? "bg-bg-root text-fg-default"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
            )}
          >
            {panelLabel(tab.kind)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
