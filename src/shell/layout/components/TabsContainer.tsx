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
      <div className="flex h-tab shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 bg-bg-surface px-2">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-active={isActive}
              onClick={() => onSelect(tab.id)}
              className={cn("pragma-pill-tab", isActive && "data-active=true")}
            >
              {panelLabel(tab.kind)}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
