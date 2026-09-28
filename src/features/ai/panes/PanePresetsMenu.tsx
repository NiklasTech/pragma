"use client";

import { useMemo } from "react";
import { SquaresFour } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { openBrowserPane } from "../browser/open";
import { MAX_PANES, MAX_PANES_TITLE } from "./operations";
import { selectLeafCount, selectRoot, useAgentsPanesStore } from "./store";

export function PanePresetsMenu() {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const hasPanes = useAgentsPanesStore((state) => selectRoot(state, rootPath) !== null);
  const atCap = useAgentsPanesStore((state) => selectLeafCount(state, rootPath) >= MAX_PANES);
  const applyPreset = useAgentsPanesStore((state) => state.applyPreset);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const sessionIds = useMemo(() => chatSessions.map((session) => session.id), [chatSessions]);

  if (!hasPanes) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Pane presets"
            title="Pane presets"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
          >
            <SquaresFour size={15} />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-[120px]">
        <DropdownMenuItem onClick={() => applyPreset(rootPath, "focus", sessionIds)}>
          Focus
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyPreset(rootPath, "pair", sessionIds)}>
          Pair
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyPreset(rootPath, "grid", sessionIds)}>
          Grid
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => openBrowserPane(rootPath)}
          disabled={atCap}
          title={atCap ? MAX_PANES_TITLE : undefined}
        >
          Open browser
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
