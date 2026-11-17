import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { detectLanguage } from "@/shared/lib/language";
import { useEditorStore } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout";
import { useUiModeStore } from "@/shell/mode";
import { allPanelIds, findNode, findPanelByKind } from "@/shell/layout/tree/operations";
import { openNonTextFile } from "@/features/editor/preview/openPreview";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
  encoding: string;
}

export interface GoToPosition {
  line: number;
  column: number;
}

function editorPanelIds(): string[] {
  const root = useLayoutStore.getState().root;
  return allPanelIds(root).filter((id) => {
    const node = findNode(root, id);
    return node?.type === "panel" && node.kind === "editor";
  });
}

/// The editor panel a file opens in: the focused one, else the first; with `newPane`, a new one beside it.
function targetPanel(newPane: boolean): string | null {
  const root = useLayoutStore.getState().root;
  const focused = useEditorStore.getState().lastFocusedPanelId;
  const current = editorPanelIds().includes(focused ?? "")
    ? focused
    : (findPanelByKind(root, "editor")?.id ?? null);
  if (!newPane || !current) return current;
  const before = new Set(editorPanelIds());
  useLayoutStore.getState().splitPanel(current, "horizontal", "editor");
  return editorPanelIds().find((id) => !before.has(id)) ?? current;
}

/// Opens a file in the code tab, optionally at a position and in a new pane beside the current one.
export async function openGoToPath(
  path: string,
  options: { position?: GoToPosition; newPane?: boolean } = {},
): Promise<void> {
  // The code tab shows the file; it comes back when it was closed.
  useUiModeStore.getState().setUiMode("editor");
  const panelId = targetPanel(options.newPane === true);
  if (openNonTextFile(path, panelId)) return;
  try {
    const result = await invoke<FileReadResult>("read_text_file", { path });
    const editor = useEditorStore.getState();
    editor.openFile(
      {
        id: result.path,
        path: result.path,
        name: result.name,
        content: result.content,
        originalContent: result.content,
        isModified: false,
        language: detectLanguage(result.name),
        encoding: result.encoding,
      },
      panelId,
    );
    if (options.position) editor.goToPosition(result.path, options.position);
  } catch (error) {
    if (openNonTextFile(path, panelId, error)) return;
    toast.error(String(error));
  }
}
