import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useDiskStateStore } from "@/shared/stores/diskState";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { flushPendingDocChanges } from "@/features/editor/components/extensions/doc-sync";
import { setDiskBaseline } from "@/features/editor/diskSync";

interface FileReadResult {
  content: string;
  encoding: string;
}

function patchTab(tabId: string, patch: Partial<FileTab>): void {
  useEditorStore.setState((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === tabId && tab.kind === "file" ? { ...tab, ...patch } : tab,
    ),
  }));
}

/// Reads the file again with `encoding`; only for tabs without unsaved edits.
export async function reopenWithEncoding(tab: FileTab, encoding: string): Promise<void> {
  if (tab.isModified) {
    toast.warning("Save or discard your changes before reopening with another encoding");
    return;
  }
  try {
    const result = await invoke<FileReadResult>("read_text_file", { path: tab.path, encoding });
    useEditorStore.getState().updateFileContent(tab.id, result.content);
    patchTab(tab.id, {
      originalContent: result.content,
      isModified: false,
      encoding: result.encoding,
      encodingForced: true,
    });
    useDiskStateStore.getState().clearStatus(tab.path);
  } catch (err) {
    toast.error(`Could not reopen ${tab.name}: ${String(err)}`);
  }
}

/// Writes the current text in `encoding`, after checking the file did not change on disk.
export async function saveWithEncoding(staleTab: FileTab, encoding: string): Promise<void> {
  flushPendingDocChanges();
  const current = useEditorStore.getState().tabs.find((t) => t.id === staleTab.id);
  const tab = current?.kind === "file" ? current : staleTab;
  try {
    const disk = await invoke<FileReadResult>("read_text_file", {
      path: tab.path,
      encoding: tab.encodingForced ? tab.encoding : null,
    }).catch(() => null);
    if (disk && disk.content !== tab.originalContent) {
      useDiskStateStore.getState().setStatus(tab.path, "changed");
      toast.warning(`${tab.name} changed on disk. Reload it or keep your version first.`);
      return;
    }

    await invoke("write_text_file", { path: tab.path, content: tab.content, encoding });
    setDiskBaseline(tab.id, tab.content);
    patchTab(tab.id, { encoding, encodingForced: true });
    useDiskStateStore.getState().clearStatus(tab.path);
    toast.success(`Saved ${tab.name} as ${encoding}`);
  } catch (err) {
    toast.error(String(err));
  }
}
