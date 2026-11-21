import { useEditorStore, type DiffTab } from "@/shared/stores/editor";

type GitDiffInput = Omit<DiffTab, "kind" | "name" | "id"> & { id: string; name?: string };

/// Shows a git diff as a tab of the focused editor panel.
export function openGitDiff(editorPanelId: string | null, diff: GitDiffInput): void {
  useEditorStore.getState().openDiff(diff);
  if (editorPanelId) useEditorStore.getState().setPanelActiveTab(editorPanelId, diff.id);
}
