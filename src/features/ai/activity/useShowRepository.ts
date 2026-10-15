import { useCallback } from "react";

import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useUiModeStore } from "@/shell/mode";

import { useNamedAgentsUiStore } from "../named-agents/ui";
import { selectRoot as selectPaneRoot, useAgentsPanesStore } from "../panes/store";
import { useTasksUiStore } from "../tasks/ui";
import { sessionsToOpen, type RepositorySummary } from "./repositories";

/// Activates a repository in Agents mode and shows the given sessions, or keeps its pane layout.
export function useShowRepository(): (
  summary: RepositorySummary,
  sessionIds?: string[],
) => Promise<void> {
  const { selectRoot } = useFileExplorer();

  return useCallback(
    async (summary, sessionIds) => {
      const panes = useAgentsPanesStore.getState();
      const hasLayout = selectPaneRoot(panes, summary.path) !== null;
      const shown = sessionIds ?? (hasLayout ? [] : sessionsToOpen(summary));
      if (shown.length > 0) panes.replaceLayout(summary.path, shown);
      useTasksUiStore.getState().closeBoard();
      useNamedAgentsUiStore.getState().setView("sessions");
      useUiModeStore.getState().setUiMode("agents");
      if (useFileExplorerStore.getState().rootPath !== summary.path) {
        await selectRoot(summary.path);
      }
    },
    [selectRoot],
  );
}
