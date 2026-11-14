import { DotsThree, PushPin, PushPinSlash } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ICON_SIZE, IconButton } from "@/shared/components/ui/icon-button";
import { cn } from "@/shared/lib/utils";
import { useLayoutStore } from "@/shell/layout/store";

import { primarySidebarViews, secondarySidebarViews } from "./sidebarViews";

const VIEW_BUTTON =
  "flex h-6.5 shrink-0 items-center gap-1.5 rounded-control px-2 text-ui-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-border-focus";

/// The sidebar's view switcher and pin, at the top of the sidebar or drawer.
export function ViewShelf() {
  const tab = useLayoutStore((s) => s.sidebar.tab);
  const pinned = useLayoutStore((s) => s.sidebar.pinned);
  const setSidebarTab = useLayoutStore((s) => s.setSidebarTab);
  const setSidebarPinned = useLayoutStore((s) => s.setSidebarPinned);
  const activeSecondary = secondarySidebarViews.find((view) => view.id === tab);
  const views = activeSecondary ? [...primarySidebarViews, activeSecondary] : primarySidebarViews;

  return (
    <div className="flex shrink-0 items-center gap-1 px-1.5 pt-1.5">
      <nav
        aria-label="Sidebar views"
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
      >
        {views.map((view) => {
          const active = view.id === tab;
          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSidebarTab(view.id)}
              title={view.label}
              className={cn(
                VIEW_BUTTON,
                active
                  ? "bg-bg-active text-fg-default"
                  : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
              )}
            >
              <view.icon size={ICON_SIZE.sm} weight={active ? "fill" : "regular"} />
              <span className="@max-[260px]:hidden">{view.label}</span>
            </button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="More views"
                title="More views"
                className={cn(VIEW_BUTTON, "text-fg-muted hover:bg-bg-hover hover:text-fg-default")}
              >
                <DotsThree size={ICON_SIZE.md} weight="bold" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-[170px]">
            {secondarySidebarViews.map((view) => (
              <DropdownMenuItem key={view.id} onClick={() => setSidebarTab(view.id)}>
                <view.icon size={ICON_SIZE.sm} />
                {view.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <IconButton
        icon={pinned ? PushPinSlash : PushPin}
        label={pinned ? "Unpin sidebar" : "Pin sidebar beside the workspace"}
        size="sm"
        onClick={() => setSidebarPinned(!pinned)}
      />
    </div>
  );
}
