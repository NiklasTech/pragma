import { invoke } from "@tauri-apps/api/core";

import { recordRewindCheckpoint } from "@/features/ai/rewind/checkpoints";
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

export interface CheckpointTracker {
  has: (path: string) => boolean;
  add: (path: string) => void;
}

const foregroundCheckpoints: CheckpointTracker = {
  has: (path) => useAgentStore.getState().checkpointedPaths.includes(path),
  add: (path) => useAgentStore.getState().markCheckpointed(path),
};

async function checkpointBeforeWrite(path: string, tracker: CheckpointTracker): Promise<void> {
  if (tracker.has(path)) return;
  try {
    await invoke("local_history_snapshot", { filePath: path });
  } catch {
    // Checkpointing is best-effort; the write itself must not fail because of it.
  }
  tracker.add(path);
}

async function writeToDisk(
  path: string,
  content: string,
  tracker: CheckpointTracker = foregroundCheckpoints,
): Promise<void> {
  await checkpointBeforeWrite(path, tracker);
  await invoke("write_text_file", { path, content });
}

export function updateOpenFileTab(path: string, content: string): void {
  const editor = useEditorStore.getState();
  const open = editor.tabs.find((t) => t.kind === "file" && t.path === path);
  if (!open) return;
  editor.updateFileContent(open.id, content);
  editor.markModified(open.id, false);
}

/// Writes an approved edit without the editor diff, for runs that are not on screen.
export async function writeAgentFileEdit(
  edit: AgentFileEdit,
  tracker: CheckpointTracker,
): Promise<void> {
  await writeToDisk(edit.path, edit.content, tracker);
  updateOpenFileTab(edit.path, edit.content);
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
      originalContent: edit.originalContent,
      content: edit.content,
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

    await recordRewindCheckpoint(edit.path);
    await writeToDisk(edit.path, edit.content);
    updateOpenFileTab(edit.path, edit.content);
    editor.closeTab(id);
    return;
  }

  await recordRewindCheckpoint(edit.path);
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
