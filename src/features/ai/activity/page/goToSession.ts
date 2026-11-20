import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { findSpaceByFolder } from "@/shared/stores/spaces/model";
import { railGroups } from "@/shell/chrome/railEntries";

import { focusAttentionSession } from "../../notifications/focusSession";
import { revealPane } from "../../panes/paneCommands";
import { useAgentsPanesStore } from "../../panes/store";
import { clearOutcome } from "../store";

/// Shows the session's pane: its tab in the active space, else the session opens where it belongs.
export function goToSession(sessionId: string, rootPath: string): void {
  clearOutcome(sessionId);
  const { spaces, activeSpaceId } = useOpenRepositoriesStore.getState();
  const space = findSpaceByFolder(spaces, rootPath);
  if (space && space.id === activeSpaceId) {
    const trees = useAgentsPanesStore.getState().trees;
    const entry = railGroups(space, trees)
      .flatMap((group) => group.entries)
      .find((candidate) => candidate.sessionId === sessionId);
    if (entry) {
      revealPane(space.id, entry.tabId, entry.leafId);
      return;
    }
  }
  focusAttentionSession(sessionId);
}
