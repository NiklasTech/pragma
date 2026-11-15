"use client";

import { useMemo, useState } from "react";
import { SquaresFour } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { ICON_SIZE } from "@/shared/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useRepositorySessions } from "@/features/ai/sessions/repositorySessions";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { openBrowserPane } from "../browser/open";
import { LaunchCliDialog } from "./LaunchCliDialog";
import { MAX_PANES, MAX_PANES_TITLE } from "./operations";
import { selectLeafCount, selectRoot, useAgentsPanesStore, usePaneTreeKey } from "./store";

export function PanePresetsMenu() {
  const workspaceRoot = useFileExplorerStore((state) => state.rootPath);
  const rootPath = workspaceRoot ?? "default";
  const treeKey = usePaneTreeKey(rootPath);
  const hasPanes = useAgentsPanesStore((state) => selectRoot(state, treeKey) !== null);
  const atCap = useAgentsPanesStore((state) => selectLeafCount(state, treeKey) >= MAX_PANES);
  const applyPreset = useAgentsPanesStore((state) => state.applyPreset);
  const chatSessions = useRepositorySessions(rootPath);
  const sessionIds = useMemo(() => chatSessions.map((session) => session.id), [chatSessions]);
  const [launchOpen, setLaunchOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Pane layout"
              title="Pane layout"
              className="text-fg-subtle"
            >
              <SquaresFour size={ICON_SIZE.md} />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuItem onClick={() => setLaunchOpen(true)} disabled={!workspaceRoot}>
            Launch coding CLIs
          </DropdownMenuItem>
          {hasPanes && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Recent threads</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => applyPreset(rootPath, "focus", sessionIds)}>
                  Focus
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyPreset(rootPath, "pair", sessionIds)}>
                  Pair
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyPreset(rootPath, "grid", sessionIds)}>
                  Grid of four
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => openBrowserPane(rootPath)}
                disabled={atCap}
                title={atCap ? MAX_PANES_TITLE : undefined}
              >
                Open browser
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {workspaceRoot && <LaunchCliDialog open={launchOpen} onOpenChange={setLaunchOpen} />}
    </>
  );
}
