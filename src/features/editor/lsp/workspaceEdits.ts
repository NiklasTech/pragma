import { invoke } from "@tauri-apps/api/core";

import { useEditorStore } from "@/shared/stores/editor";
import { applyEditsToContent } from "./edits";
import type { LspFileEdit } from "./client";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

export async function applyWorkspaceEdits(fileEdits: LspFileEdit[]): Promise<void> {
  const store = useEditorStore.getState();

  for (const fileEdit of fileEdits) {
    if (fileEdit.edits.length === 0) {
      continue;
    }

    const openTab = store.tabs.find((t) => t.kind === "file" && t.path === fileEdit.filePath);
    if (openTab && openTab.kind === "file") {
      const newContent = applyEditsToContent(openTab.content, fileEdit.edits);
      store.updateFileContent(openTab.id, newContent);
      continue;
    }

    const result = await invoke<FileReadResult>("read_text_file", { path: fileEdit.filePath });
    const newContent = applyEditsToContent(result.content, fileEdit.edits);
    await invoke("write_text_file", { path: fileEdit.filePath, content: newContent });
  }
}
