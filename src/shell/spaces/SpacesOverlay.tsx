import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  OverlaySheet,
  OverlaySheetContent,
  OverlaySheetTitle,
} from "@/shared/components/ui/overlay-sheet";
import { StatusDot } from "@/shared/components/ui/status-dot";
import { selectRootFolder } from "@/shared/hooks/useFileExplorer";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayOpen, useOverlayStore } from "@/shared/stores/overlays";
import { primaryFolder } from "@/shared/stores/spaces/model";
import { useSessionActivity } from "@/features/ai/notifications/useSessionActivity";

import { WorkspaceMenu } from "@/shell/chrome/WorkspaceMenu";

import { SpaceDetails } from "./SpaceDetails";
import { spaceState, spaceSubtitle } from "./spaceSummary";

/// Every open space with its worktrees, agents, tabs and saved layouts; opens from the space name.
export function SpacesOverlay() {
  const isOpen = useOverlayOpen("spaces");
  const close = useOverlayStore((state) => state.close);
  const spaces = useOpenRepositoriesStore((state) => state.spaces);
  const activeSpaceId = useOpenRepositoriesStore((state) => state.activeSpaceId);
  const sessions = useAIStore((state) => state.chatSessions);
  const activity = useSessionActivity();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    spaces.find((space) => space.id === selectedId) ??
    spaces.find((space) => space.id === activeSpaceId) ??
    spaces[0];
  const done = () => close("spaces");

  return (
    <OverlaySheet
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        done();
        setSelectedId(null);
      }}
    >
      <OverlaySheetContent placement="top" className="h-[min(640px,76vh)] max-w-[960px] flex-row">
        <OverlaySheetTitle className="sr-only">Spaces</OverlaySheetTitle>
        <nav
          aria-label="Spaces"
          className="flex w-[240px] shrink-0 flex-col gap-0.5 border-r border-border-subtle bg-bg-ground/40 p-2.5"
        >
          <span className="px-2.5 pt-0.5 pb-2 text-ui-xs font-medium text-fg-subtle">Spaces</span>
          {spaces.map((space) => {
            const count = sessions.filter(
              (session) => space.folders.includes(session.rootPath) && !session.archived,
            ).length;
            const state = spaceState(space, sessions, activity);
            const current = space.id === selected?.id;
            return (
              <Button
                key={space.id}
                variant="ghost"
                aria-current={current ? "true" : undefined}
                onClick={() => setSelectedId(space.id)}
                className={cn(
                  "h-auto justify-start gap-2.5 px-2.5 py-2 text-left font-normal text-fg-default",
                  current && "bg-bg-active",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-bg-active text-ui-xs font-semibold text-fg-muted">
                  {space.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ui-sm font-medium">{space.name}</span>
                  <span className="truncate text-ui-xs text-fg-subtle">
                    {spaceSubtitle(space, count)}
                  </span>
                </span>
                <StatusDot state={state} />
              </Button>
            );
          })}
          <div className="mt-auto pt-2">
            <WorkspaceMenu />
          </div>
        </nav>
        {selected && (
          <SpaceDetails
            key={selected.id}
            space={selected}
            active={selected.id === activeSpaceId}
            onOpen={async () => {
              if (selected.id !== activeSpaceId) await selectRootFolder(primaryFolder(selected));
            }}
            onDone={done}
          />
        )}
      </OverlaySheetContent>
    </OverlaySheet>
  );
}
