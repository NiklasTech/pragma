import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { detectLanguage } from "@/shared/lib/language";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";

import type { ResolvedApplyTarget } from "./applyTargets";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

function findOpenTab(target: ResolvedApplyTarget): FileTab | undefined {
  const editor = useEditorStore.getState();
  const byId = target.tabId
    ? editor.tabs.find((tab): tab is FileTab => tab.kind === "file" && tab.id === target.tabId)
    : undefined;
  return (
    byId ??
    editor.tabs.find((tab): tab is FileTab => tab.kind === "file" && tab.path === target.path)
  );
}

export async function applyChatCodeBlock(target: ResolvedApplyTarget): Promise<void> {
  const editor = useEditorStore.getState();
  let tab = findOpenTab(target);
  let original = tab?.content ?? target.originalCode;

  if (!tab) {
    try {
      const result = await invoke<FileReadResult>("read_text_file", { path: target.path });
      useEditorStore.getState().openFile({
        id: result.path,
        path: result.path,
        name: result.name,
        content: result.content,
        originalContent: result.content,
        isModified: false,
        language: detectLanguage(result.name),
      });
      tab = findOpenTab({ ...target, tabId: result.path });
      original = result.content;
    } catch (err) {
      toast.error(`Could not open ${target.name}: ${String(err)}`);
      return;
    }
  }

  if (!tab) return;

  editor.openDiff({
    id: `chat-apply:${target.path}:${Date.now()}`,
    path: target.path,
    original,
    modified: target.code,
    patchText: "",
    staged: false,
    sourceTabId: tab.id,
    name: `${target.name} (Chat Edit)`,
  });
}
