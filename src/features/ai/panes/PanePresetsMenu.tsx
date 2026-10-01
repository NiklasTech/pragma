"use client";

import { useMemo, useState } from "react";
import { SquaresFour } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { openBrowserPane } from "../browser/open";
import { LaunchCliDialog } from "./LaunchCliDialog";
import { MAX_PANES, MAX_PANES_TITLE } from "./operations";
import { selectLeafCount, selectRoot, useAgentsPanesStore } from "./store";

export function PanePresetsMenu() {
  const workspaceRoot = useFileExplorerStore((state) => state.rootPath);
  const rootPath = workspaceRoot ?? "default";
  const hasPanes = useAgentsPanesStore((state) => selectRoot(state, rootPath) !== null);
  const atCap = useAgentsPanesStore((state) => selectLeafCount(state, rootPath) >= MAX_PANES);
  const applyPreset = useAgentsPanesStore((state) => state.applyPreset);
  const arrange = useAgentsPanesStore((state) => state.arrange);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const sessionIds = useMemo(() => chatSessions.map((session) => session.id), [chatSessions]);
  const [launchOpen, setLaunchOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Pane layout"
              title="Pane layout"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
            >
              <SquaresFour size={15} />
            </button>
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
                <DropdownMenuLabel>Arrange open panes</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => arrange(rootPath, "grid")}>Grid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => arrange(rootPath, "columns")}>
                  Columns
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => arrange(rootPath, "rows")}>Rows</DropdownMenuItem>
              </DropdownMenuGroup>
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

      {workspaceRoot && (
        <LaunchCliDialog rootPath={workspaceRoot} open={launchOpen} onOpenChange={setLaunchOpen} />
      )}
    </>
  );
}
