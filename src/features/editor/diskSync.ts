import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useEditorStore, type EditorTab, type FileTab } from "@/shared/stores/editor";
import { useDiskStateStore } from "@/shared/stores/diskState";
import { isMissingFileError, isSameOrInside } from "@/shared/lib/fileDisk";
import { flushPendingDocChanges } from "@/features/editor/components/extensions/doc-sync";

interface FileReadResult {
  content: string;
  encoding: string;
}

function isFileTab(tab: EditorTab): tab is FileTab {
  return tab.kind === "file";
}

function findFileTab(tabId: string): FileTab | null {
  const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
  return tab && isFileTab(tab) ? tab : null;
}

/// Reads the file as it is on disk now; null when it no longer exists. A detected encoding
/// that changed on disk is kept on the tab so the next save writes it the same way.
async function readDisk(tab: FileTab): Promise<string | null> {
  try {
    const encoding = tab.encodingForced ? tab.encoding : null;
    const result = await invoke<FileReadResult>("read_text_file", { path: tab.path, encoding });
    if (result.encoding !== tab.encoding) {
      useEditorStore.setState((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tab.id && isFileTab(t) ? { ...t, encoding: result.encoding } : t,
        ),
      }));
    }
    return result.content;
  } catch (err) {
    if (isMissingFileError(err)) return null;
    throw err;
  }
}

/// Records `diskContent` as the saved state of the tab without touching the edited text.
export function setDiskBaseline(tabId: string, diskContent: string): void {
  useEditorStore.setState((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === tabId && isFileTab(t)
        ? { ...t, originalContent: diskContent, isModified: t.content !== diskContent }
        : t,
    ),
  }));
}

function replaceWithDisk(tabId: string, diskContent: string): void {
  const editor = useEditorStore.getState();
  editor.updateFileContent(tabId, diskContent);
  setDiskBaseline(tabId, diskContent);
}

async function syncTab(tabId: string): Promise<void> {
  const before = findFileTab(tabId);
  if (!before) return;

  let disk: string | null;
  try {
    disk = await readDisk(before);
  } catch {
    // Unreadable for now (binary, too large, locked); keep the tab as it is.
    return;
  }

  // Edits still being debounced count as unsaved, so a reload must not drop them.
  flushPendingDocChanges();
  const tab = findFileTab(tabId);
  if (!tab) return;
  const diskState = useDiskStateStore.getState();

  if (disk === null) {
    diskState.setStatus(tab.path, "deleted");
  } else if (disk === tab.originalContent) {
    diskState.clearStatus(tab.path);
  } else if (!tab.isModified) {
    replaceWithDisk(tab.id, disk);
    diskState.clearStatus(tab.path);
  } else {
    diskState.setStatus(tab.path, "changed");
  }
}

/// Reloads clean tabs and flags tabs with unsaved edits whose file changed or vanished.
export async function syncTabsWithDisk(changedPaths: string[]): Promise<void> {
  const affected = useEditorStore
    .getState()
    .tabs.filter(isFileTab)
    .filter((tab) => changedPaths.some((path) => isSameOrInside(tab.path, path)));
  await Promise.all(affected.map((tab) => syncTab(tab.id)));
}

export async function reloadFromDisk(tabId: string): Promise<void> {
  const tab = findFileTab(tabId);
  if (!tab) return;
  try {
    const disk = await readDisk(tab);
    if (disk === null) {
      useDiskStateStore.getState().setStatus(tab.path, "deleted");
      return;
    }
    replaceWithDisk(tabId, disk);
    useDiskStateStore.getState().clearStatus(tab.path);
  } catch (err) {
    toast.error(String(err));
  }
}

/// Keeps the edited text and accepts the disk version as the base, so the next save overwrites it.
export async function keepLocalVersion(tabId: string): Promise<void> {
  const tab = findFileTab(tabId);
  if (!tab) return;
  try {
    const disk = await readDisk(tab);
    if (disk !== null) setDiskBaseline(tabId, disk);
    useDiskStateStore.getState().clearStatus(tab.path);
  } catch (err) {
    toast.error(String(err));
  }
}

export async function compareWithDisk(tabId: string): Promise<void> {
  flushPendingDocChanges();
  const tab = findFileTab(tabId);
  if (!tab) return;
  try {
    const disk = await readDisk(tab);
    const editor = useEditorStore.getState();
    const id = `disk-compare:${tab.path}`;
    editor.closeTab(id);
    editor.openDiff({
      id,
      path: tab.path,
      name: `${tab.name} (Disk vs Local)`,
      original: disk ?? "",
      modified: tab.content,
      patchText: "",
      staged: false,
    });
  } catch (err) {
    toast.error(String(err));
  }
}
