import type { UIMessage } from "@ai-sdk/react";
import { invoke } from "@tauri-apps/api/core";

import { updateOpenFileTab } from "@/features/agent/applyEdit";
import { showSessionInPane } from "@/features/ai/children/open";
import { saveSessionMessages } from "@/shared/lib/chat-storage";
import { uiMessageToStored } from "@/shared/lib/ai/protocol";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { checkpointsToRestore, useRewindCheckpointStore, type FileCheckpoint } from "./checkpoints";

function userMessageIdsAfter(messages: UIMessage[], index: number): string[] {
  return messages
    .slice(index + 1)
    .filter((message) => message.role === "user")
    .map((message) => message.id);
}

/// Files the agent changed in the turns after the message, with the content they go back to.
export function rewindFiles(
  sessionId: string,
  messages: UIMessage[],
  index: number,
): FileCheckpoint[] {
  return checkpointsToRestore(
    useRewindCheckpointStore.getState().checkpoints,
    sessionId,
    userMessageIdsAfter(messages, index),
  );
}

async function restoreFile(checkpoint: FileCheckpoint): Promise<void> {
  if (checkpoint.before === null) {
    try {
      await invoke("delete_file", { path: checkpoint.path });
    } catch (err) {
      if (!String(err).startsWith("Not found")) throw err;
    }
    return;
  }
  await invoke("write_text_file", { path: checkpoint.path, content: checkpoint.before });
  updateOpenFileTab(checkpoint.path, checkpoint.before);
}

/// Restores the files changed after the message and returns the paths that could not be restored.
export async function restoreRewindFiles(
  sessionId: string,
  messages: UIMessage[],
  index: number,
): Promise<string[]> {
  const failed: string[] = [];
  for (const checkpoint of rewindFiles(sessionId, messages, index)) {
    try {
      await restoreFile(checkpoint);
    } catch {
      failed.push(checkpoint.path);
    }
  }
  useRewindCheckpointStore.getState().forget(sessionId, userMessageIdsAfter(messages, index));
  return failed;
}

/// Keeps the checkpoints of turns an edit discards, so a later rewind still restores their files.
export function keepCheckpointsForEdit(
  sessionId: string,
  messages: UIMessage[],
  index: number,
): void {
  const edited = messages[index];
  if (!edited) return;
  useRewindCheckpointStore
    .getState()
    .moveTo(sessionId, userMessageIdsAfter(messages, index), edited.id);
}

/// Starts a new thread with the conversation up to and including the message.
export async function forkThread(
  rootPath: string,
  source: ChatSession,
  messages: UIMessage[],
  index: number,
): Promise<void> {
  const { createChatSession, updateChatSessionMessages, setActiveChatSession } =
    useAIStore.getState();
  const history = messages.slice(0, index + 1).map(uiMessageToStored);

  const fork = await createChatSession(
    rootPath,
    {
      title: `${source.title} (fork)`,
      kind: source.kind,
      cliProviderId: source.cliProviderId,
      agentId: source.agentId,
      agentEngine: source.agentEngine,
      category: source.category,
    },
    { activate: false },
  );
  await saveSessionMessages(rootPath, fork.id, history);
  updateChatSessionMessages(fork.id, history);
  setActiveChatSession(fork.id);
  showSessionInPane(rootPath, fork.id);
}
