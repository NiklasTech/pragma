import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useEditorStore } from "@/shared/stores/editor";
import { useDiskStateStore } from "@/shared/stores/diskState";
import { useSettingsStore } from "@/shared/stores/settings";
import { applySaveTransforms } from "@/shared/lib/editor/saveTransforms";
import { isSkillPath } from "@/features/ai/skills/paths";
import { useSkillsStore } from "@/features/ai/skills/store";
import { setDiskBaseline } from "@/features/editor/diskSync";
import { isChangedOnDiskError, sha256Hex } from "@/shared/lib/fileDisk";
import { flushPendingDocChanges } from "@/features/editor/components/extensions/doc-sync";
import { notifyFileSaved } from "@/features/extensions/events";

interface SaveFileOptions {
  /// Autosave skips the conflict toast; the editor notice already shows the conflict.
  auto?: boolean;
}

function conflictMessage(name: string): string {
  return `${name} changed on disk. Reload it, keep your version or compare before saving.`;
}

export function useSaveFile({ auto = false }: SaveFileOptions = {}) {
  return useCallback(async () => {
    flushPendingDocChanges();
    const { tabs, activeTabId } = useEditorStore.getState();
    const tab = tabs.find((candidate) => candidate.id === activeTabId);
    if (!tab || tab.kind !== "file") return;
    if (!tab.isModified) return;

    const diskState = useDiskStateStore.getState();
    const status = diskState.statuses[tab.path];
    if (status === "changed") {
      if (!auto) toast.warning(conflictMessage(tab.name));
      return;
    }

    const editorSettings = useSettingsStore.getState().editor;
    // Delayed autosave fires while typing; trimming would remove the space just typed.
    const transform = !auto || editorSettings.autoSave !== "afterDelay";
    const content = transform ? applySaveTransforms(tab.content, editorSettings) : tab.content;
    if (content !== tab.content) useEditorStore.getState().updateFileContent(tab.id, content);
    try {
      await invoke("write_text_file", {
        path: tab.path,
        content,
        expectedHash: status === "deleted" ? null : await sha256Hex(tab.originalContent),
      });
      setDiskBaseline(tab.id, content);
      diskState.clearStatus(tab.path);
      if (isSkillPath(tab.path)) void useSkillsStore.getState().reloadSkills();
      notifyFileSaved(tab.path, tab.language ?? null);
      toast.success(`Saved ${tab.name}`);
    } catch (err) {
      if (isChangedOnDiskError(err)) {
        diskState.setStatus(tab.path, "changed");
        if (!auto) toast.warning(conflictMessage(tab.name));
        return;
      }
      toast.error(String(err));
    }
  }, [auto]);
}
