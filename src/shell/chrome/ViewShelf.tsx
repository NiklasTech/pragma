import { DotsThree, PushPin, PushPinSlash } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ICON_SIZE, IconButton } from "@/shared/components/ui/icon-button";
import { cn } from "@/shared/lib/utils";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useLayoutStore } from "@/shell/layout/store";

import { primarySidebarViews, secondarySidebarViews } from "./sidebarViews";

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
            <Button
              key={view.id}
              variant="ghost"
              size="sm"
              aria-pressed={active}
              onClick={() =>
                // History opens as the git overlay, where agent branches have room next to the log.
                view.id === "git" ? useOverlayStore.getState().open("git") : setSidebarTab(view.id)
              }
              title={view.label}
              className={cn("px-2 font-normal", active && "bg-bg-active text-fg-default")}
            >
              <view.icon size={ICON_SIZE.sm} weight={active ? "fill" : "regular"} />
              <span className="@max-[260px]:hidden">{view.label}</span>
            </Button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label="More views"
                title="More views"
                className="px-2"
              >
                <DotsThree size={ICON_SIZE.md} weight="bold" />
              </Button>
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
