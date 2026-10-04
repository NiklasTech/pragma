import type { AttentionKind } from "./activity";

type OutcomeListener = (sessionId: string, kind: AttentionKind) => void;

const listeners = new Set<OutcomeListener>();

/// The chat reports how a run of a top-level session ended; child runs are watched in their store.
export function reportSessionOutcome(sessionId: string, outcome: "done" | "error"): void {
  const kind: AttentionKind = outcome === "done" ? "finished" : "failed";
  for (const listener of listeners) listener(sessionId, kind);
}

export function subscribeSessionOutcomes(listener: OutcomeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
