import { CaretDown, Check } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ICON_SIZE } from "@/shared/components/ui/icon-button";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import type { SpaceTab } from "@/shared/stores/spaces/model";

import { TabNumber } from "./TabNumber";

export interface TabEntry {
  tab: SpaceTab;
  paneCount: number;
  waiting: boolean;
}

interface AllTabsMenuProps {
  spaceId: string;
  activeTabId: string;
  entries: TabEntry[];
}

/// Every tab of the space as a list, for when they no longer fit in the strip.
export function AllTabsMenu({ spaceId, activeTabId, entries }: AllTabsMenuProps) {
  const activateTab = useOpenRepositoriesStore((state) => state.activateTab);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label={`All ${entries.length} tabs`}
            title="All tabs"
            className="h-7 shrink-0 gap-1 px-1.5 text-ui-2xs font-normal text-fg-subtle"
          >
            {entries.length}
            <CaretDown size={12} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="max-w-[320px] min-w-[220px]">
        {entries.map(({ tab, paneCount, waiting }, index) => (
          <DropdownMenuItem key={tab.id} onClick={() => activateTab(spaceId, tab.id)}>
            <TabNumber number={index + 1} active={tab.id === activeTabId} waiting={waiting} />
            <span className="min-w-0 truncate">{tab.name}</span>
            {paneCount > 0 && <span className="text-ui-2xs text-fg-subtle">{paneCount}</span>}
            {waiting && <span className="sr-only">, needs you</span>}
            {tab.id === activeTabId && (
              <Check size={ICON_SIZE.sm} aria-label="Active" className="ml-auto text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
