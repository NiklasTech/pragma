import { toast } from "sonner";
import { create } from "zustand";

import { useAgentStore } from "@/features/agent/store";
import { requestMessages } from "@/shared/lib/ai/compaction";
import { storedMessagesToUI, uiMessageToStored } from "@/shared/lib/ai/protocol";
import { pinnedSessionEngine, resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { resolveContextWindow } from "../usage/contextWindow";
import { liveChat } from "./liveChat";
import { insertSummary, planSummary, renderTranscript } from "./plan";
import { estimateTokens, pruneToolOutputs } from "./prune";
import { summarizeConversation } from "./summarize";

export type CompactionMode = "manual" | "auto";

export const AUTO_COMPACT_RATIO = 0.8;
// Pruning tool outputs alone is enough when it brings the context below this fill.
const PRUNED_ENOUGH_RATIO = 0.6;
const TRANSCRIPT_BUDGET_RATIO = 0.5;
const FALLBACK_CONTEXT_WINDOW = 32_000;

export const useCompactionStore = create<{ running: Record<string, boolean> }>()(() => ({
  running: {},
}));

const runs = new Map<string, Promise<boolean>>();

function setRunning(sessionId: string, running: boolean) {
  useCompactionStore.setState((state) => {
    const next = { ...state.running };
    if (running) next[sessionId] = true;
    else delete next[sessionId];
    return { running: next };
  });
}

function builtinEngine(session: ChatSession) {
  const engine = resolveEffectiveEngine(pinnedSessionEngine(session), useAIStore.getState());
  return engine.cliProviderId === null ? engine : null;
}

function contextWindow(session: ChatSession): number | null {
  const engine = builtinEngine(session);
  if (!engine) return null;
  return (
    session.usage?.contextWindow ??
    resolveContextWindow(engine.model, useAIStore.getState().availableModels[engine.provider])
  );
}

function agentRunning(sessionId: string): boolean {
  const { runSessionId, status } = useAgentStore.getState();
  return runSessionId === sessionId && (status === "running" || status === "waiting-approval");
}

async function runCompaction(sessionId: string, mode: CompactionMode): Promise<boolean> {
  const manual = mode === "manual";
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  if (!session) return false;

  const engine = builtinEngine(session);
  if (!engine) {
    if (manual) toast.info("Coding agents manage their own context.");
    return false;
  }
  if (!engine.model) {
    if (manual) toast.error("Choose a model before compacting the session.");
    return false;
  }

  const live = liveChat(sessionId);
  if (live?.busy() || agentRunning(sessionId)) {
    if (manual) toast.info("Wait until the current response has finished.");
    return false;
  }

  const before = live ? live.messages() : storedMessagesToUI(session.messages);
  const size = contextWindow(session) ?? FALLBACK_CONTEXT_WINDOW;
  const used = session.usage?.contextTokens;
  const pruned = pruneToolOutputs(before);
  let next = pruned.messages;
  let summarized = false;

  const prunedUsed = used === undefined ? undefined : used - pruned.removedChars / 4;
  if (manual || prunedUsed === undefined || prunedUsed >= size * PRUNED_ENOUGH_RATIO) {
    const plan = planSummary(next);
    if (plan) {
      try {
        const transcript = renderTranscript(plan, size * TRANSCRIPT_BUDGET_RATIO * 4);
        next = insertSummary(next, plan.cutIndex, await summarizeConversation(engine, transcript));
        summarized = true;
      } catch (err) {
        toast.error(`Could not summarize the session: ${String(err)}`);
        if (pruned.removedChars === 0) return false;
      }
    }
  }

  if (!summarized && pruned.removedChars === 0) {
    if (manual) toast.info("Nothing to compact yet. Compacting needs at least two turns.");
    return false;
  }

  // The session may have changed or opened in a chat while the summary was written.
  const target = liveChat(sessionId);
  const current = target
    ? target.messages()
    : storedMessagesToUI(
        useAIStore.getState().chatSessions.find((item) => item.id === sessionId)?.messages ?? [],
      );
  if (target?.busy() || current.length !== before.length) {
    if (manual) toast.info("The session changed while compacting. Try again.");
    return false;
  }

  const store = useAIStore.getState();
  const rootPath = useFileExplorerStore.getState().rootPath ?? "default";
  if (target) {
    target.setMessages(next);
  } else {
    const stored = next.map(uiMessageToStored);
    store.updateChatSessionMessages(sessionId, stored);
    void store.saveSessionMessages(rootPath, sessionId, stored);
  }

  if (used !== undefined) {
    const overhead = Math.max(0, used - estimateTokens(requestMessages(before)));
    store.setSessionContextTokens(sessionId, overhead + estimateTokens(requestMessages(next)));
    const updated = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
    if (updated) void store.saveSession(rootPath, updated);
  }

  if (manual) toast.success("Compacted the session.");
  return true;
}

/// Prunes old tool outputs and summarizes older turns; resolves to whether anything changed.
export function compactSession(sessionId: string, mode: CompactionMode): Promise<boolean> {
  const pending = runs.get(sessionId);
  if (pending) return pending;

  setRunning(sessionId, true);
  const run = runCompaction(sessionId, mode)
    .catch((err: unknown) => {
      toast.error(`Could not compact the session: ${String(err)}`);
      return false;
    })
    .finally(() => {
      runs.delete(sessionId);
      setRunning(sessionId, false);
    });
  runs.set(sessionId, run);
  return run;
}

/// Compacts before the next message once the context is nearly full.
export async function compactIfNeeded(sessionId: string): Promise<void> {
  await runs.get(sessionId);

  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  const used = session?.usage?.contextTokens;
  if (!session || used === undefined) return;
  const size = contextWindow(session);
  if (!size || used / size < AUTO_COMPACT_RATIO) return;

  await compactSession(sessionId, "auto");
}
