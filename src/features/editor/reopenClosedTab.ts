import { openWorkspaceFile } from "@/features/ai/components/openWorkspaceFile";
import { useClosedTabsStore } from "@/shared/stores/closedTabs";
import { useEditorStore } from "@/shared/stores/editor";

/// Reopens the most recently closed file tab and restores its cursor.
export async function reopenClosedTab(panelId: string | null): Promise<void> {
  const entry = useClosedTabsStore.getState().pop();
  if (!entry) return;

  const opened = await openWorkspaceFile(entry.path, panelId);
  if (opened && entry.cursor) {
    useEditorStore.getState().goToPosition(entry.path, entry.cursor);
  }
}
