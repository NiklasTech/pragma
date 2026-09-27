import { DotsThree } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useLayoutStore } from "@/shell/layout/store";

import { primarySidebarViews, secondarySidebarViews, type SidebarView } from "./sidebarViews";

function ShelfItem({
  view,
  isActive,
  onSelect,
}: {
  view: SidebarView;
  isActive: boolean;
  onSelect: () => void;
}) {
  if (isActive) {
    return (
      <button
        type="button"
        aria-pressed="true"
        aria-label={view.label}
        onClick={onSelect}
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent-subtle pr-3 pl-2.5 text-ui-xs font-medium text-primary"
      >
        <view.icon size={15} weight="fill" />
        {view.label}
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        aria-pressed="false"
        aria-label={view.label}
        onClick={onSelect}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
      >
        <view.icon size={16} />
      </TooltipTrigger>
      <TooltipContent side="top">{view.label}</TooltipContent>
    </Tooltip>
  );
}

/// Floating switcher at the foot of the sidebar; the active view carries its name.
export function ViewShelf() {
  const tab = useLayoutStore((s) => s.sidebar.tab);
  const setSidebarTab = useLayoutStore((s) => s.setSidebarTab);
  const activeSecondary = secondarySidebarViews.find((view) => view.id === tab);

  return (
    <nav
      aria-label="Sidebar views"
      className="flex max-w-full items-center gap-0.5 overflow-hidden rounded-full border border-border bg-bg-surface p-1 shadow-[var(--shadow-sm)]"
    >
      {primarySidebarViews.map((view) => (
        <ShelfItem
          key={view.id}
          view={view}
          isActive={view.id === tab}
          onSelect={() => setSidebarTab(view.id)}
        />
      ))}
      {activeSecondary && (
        <ShelfItem view={activeSecondary} isActive onSelect={() => setSidebarTab(tab)} />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="More views"
              title="More views"
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
            >
              <DotsThree size={18} weight="bold" />
            </button>
          }
        />
        <DropdownMenuContent side="top" align="end" className="min-w-[170px]">
          {secondarySidebarViews.map((view) => (
            <DropdownMenuItem key={view.id} onClick={() => setSidebarTab(view.id)}>
              <view.icon size={14} />
              {view.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
