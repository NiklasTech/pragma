import { homeDir } from "@tauri-apps/api/path";
import { openWorkspaceFile } from "@/features/ai/components/openWorkspaceFile";
import { resolveTerminalPath, type PathLink } from "@/shared/lib/terminalLinks";
import { useEditorStore } from "@/shared/stores/editor";
import { useUiModeStore } from "@/shell/mode";

let home: Promise<string | null> | null = null;

function homePath(): Promise<string | null> {
  home ??= homeDir().catch(() => null);
  return home;
}

/** Opens a path printed in a terminal in the editor, at its line when it has one. */
export async function openTerminalPath(link: PathLink, cwd: string | null): Promise<void> {
  const absolute = resolveTerminalPath(link.path, cwd, await homePath());
  if (!absolute) return;
  if (!(await openWorkspaceFile(absolute, null))) return;

  useUiModeStore.getState().setUiMode("editor");
  if (link.line === undefined) return;
  const editor = useEditorStore.getState();
  if (editor.activeTabId) {
    editor.goToPosition(editor.activeTabId, { line: link.line, column: link.column ?? 1 });
  }
}
