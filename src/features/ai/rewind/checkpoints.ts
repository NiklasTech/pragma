import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { useAgentStore } from "@/features/agent/store";
import { useAIStore } from "@/shared/stores/ai";

/// A file's content before the agent first wrote it during the turn a user message started.
export interface FileCheckpoint {
  sessionId: string;
  messageId: string;
  path: string;
  /** Null when the agent created the file. */
  before: string | null;
}

interface CheckpointState {
  checkpoints: FileCheckpoint[];
  record: (checkpoint: FileCheckpoint) => void;
  moveTo: (sessionId: string, fromMessageIds: string[], messageId: string) => void;
  forget: (sessionId: string, messageIds: string[]) => void;
}

export const useRewindCheckpointStore = create<CheckpointState>()((set) => ({
  checkpoints: [],
  record: (checkpoint) => set((state) => ({ checkpoints: [...state.checkpoints, checkpoint] })),
  moveTo: (sessionId, fromMessageIds, messageId) =>
    set((state) => ({
      checkpoints: state.checkpoints.map((checkpoint) =>
        checkpoint.sessionId === sessionId && fromMessageIds.includes(checkpoint.messageId)
          ? { ...checkpoint, messageId }
          : checkpoint,
      ),
    })),
  forget: (sessionId, messageIds) =>
    set((state) => ({
      checkpoints: state.checkpoints.filter(
        (checkpoint) =>
          checkpoint.sessionId !== sessionId || !messageIds.includes(checkpoint.messageId),
      ),
    })),
}));

/// The oldest checkpoint per path among the given turns, which is the content to restore.
export function checkpointsToRestore(
  checkpoints: FileCheckpoint[],
  sessionId: string,
  messageIds: string[],
): FileCheckpoint[] {
  const byPath = new Map<string, FileCheckpoint>();
  for (const checkpoint of checkpoints) {
    if (checkpoint.sessionId !== sessionId || !messageIds.includes(checkpoint.messageId)) continue;
    if (!byPath.has(checkpoint.path)) byPath.set(checkpoint.path, checkpoint);
  }
  return [...byPath.values()];
}

async function readBefore(path: string): Promise<{ content: string | null } | null> {
  try {
    const result = await invoke<{ content: string }>("read_text_file", { path });
    return { content: result.content };
  } catch (err) {
    // Only a missing file is safe to delete on rewind; other read errors leave it untracked.
    return String(err).startsWith("File not found") ? { content: null } : null;
  }
}

function currentTurnMessageId(sessionId: string): string | null {
  const session = useAIStore.getState().chatSessions.find((s) => s.id === sessionId);
  const messages = session?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].id;
  }
  return null;
}

/// Records the file's content before the focused agent run writes it for the first time this turn.
export async function recordRewindCheckpoint(path: string): Promise<void> {
  const sessionId = useAgentStore.getState().runSessionId;
  if (!sessionId) return;
  const messageId = currentTurnMessageId(sessionId);
  if (!messageId) return;

  const exists = (): boolean =>
    useRewindCheckpointStore
      .getState()
      .checkpoints.some(
        (c) => c.sessionId === sessionId && c.messageId === messageId && c.path === path,
      );
  if (exists()) return;

  const before = await readBefore(path);
  if (!before || exists()) return;
  useRewindCheckpointStore
    .getState()
    .record({ sessionId, messageId, path, before: before.content });
}
