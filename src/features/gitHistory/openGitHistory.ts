import { useEditorStore } from "@/shared/stores/editor";

/** Shows the git history as a tab in the editor the user worked in last. */
export function openGitHistory(): void {
  const editor = useEditorStore.getState();
  editor.openHistory(editor.lastFocusedPanelId);
}
