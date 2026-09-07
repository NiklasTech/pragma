import { invoke } from "@tauri-apps/api/core";

import { useEditorStore } from "@/shared/stores/editor";

import type { AgentApprovalDecision } from "./permissions";
import { useAgentStore } from "./store";

export interface AgentFileEdit {
  toolCallId: string;
  path: string;
  originalContent: string;
  content: string;
}

function diffId(toolCallId: string): string {
  return `agent-edit:${toolCallId}`;
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

async function checkpointBeforeWrite(path: string): Promise<void> {
  const store = useAgentStore.getState();
  if (store.checkpointedPaths.includes(path)) return;
  try {
    await invoke("local_history_snapshot", { filePath: path });
  } catch {
    // Checkpointing is best-effort; the write itself must not fail because of it.
  }
  store.markCheckpointed(path);
}

async function writeToDisk(path: string, content: string): Promise<void> {
  await checkpointBeforeWrite(path);
  await invoke("write_text_file", { path, content });
}

function updateOpenFileTab(path: string, content: string): void {
  const editor = useEditorStore.getState();
  const open = editor.tabs.find((t) => t.kind === "file" && t.path === path);
  if (!open) return;
  editor.updateFileContent(open.id, content);
  editor.markModified(open.id, false);
}

// Routes an agent file edit through the editor's diff UI. When approval is
// required the write is deferred until the user accepts the InlineDiff review;
// otherwise it is written immediately and the diff is opened view-only.
export async function applyAgentFileEdit(
  edit: AgentFileEdit,
  decision: AgentApprovalDecision,
): Promise<void> {
  const editor = useEditorStore.getState();
  const id = diffId(edit.toolCallId);
  const name = `${baseName(edit.path)} (Agent Edit)`;

  if (decision === "required") {
    const accepted = useAgentStore.getState().requestEditReview({
      toolCallId: edit.toolCallId,
      path: edit.path,
    });
    editor.openDiff({
      id,
      path: edit.path,
      original: edit.originalContent,
      modified: edit.content,
      patchText: "",
      staged: false,
      agentReviewId: edit.toolCallId,
      agentApplied: false,
      name,
    });

    if (!(await accepted)) {
      editor.closeTab(id);
      throw new Error("The user rejected this edit.");
    }

    await writeToDisk(edit.path, edit.content);
    updateOpenFileTab(edit.path, edit.content);
    editor.closeTab(id);
    return;
  }

  await writeToDisk(edit.path, edit.content);
  updateOpenFileTab(edit.path, edit.content);
  editor.openDiff({
    id,
    path: edit.path,
    original: edit.originalContent,
    modified: edit.content,
    patchText: "",
    staged: false,
    agentReviewId: edit.toolCallId,
    agentApplied: true,
    name,
  });
}
