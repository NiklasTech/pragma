import { create } from "zustand";

interface HandoffState {
  /** When each session's CLI stopped at its usage limit. */
  limitHit: Record<string, number>;
  /** The usage window each session's card was put away for. */
  dismissed: Record<string, string>;
  /** When a session waiting for the reset gets its "continue". */
  waitingUntil: Record<string, number>;
}

export const useHandoffStore = create<HandoffState>()(() => ({
  limitHit: {},
  dismissed: {},
  waitingUntil: {},
}));

function setEntry<K extends keyof HandoffState>(
  key: K,
  sessionId: string,
  value: HandoffState[K][string] | null,
): void {
  useHandoffStore.setState((state) => {
    const next = { ...state[key] };
    if (value === null) delete next[sessionId];
    else next[sessionId] = value;
    return { [key]: next };
  });
}

export function markLimitHit(sessionId: string): void {
  setEntry("limitHit", sessionId, Date.now());
}

export function dismissHandoff(sessionId: string, windowKey: string): void {
  setEntry("dismissed", sessionId, windowKey);
  setEntry("limitHit", sessionId, null);
}

export function setWaitingUntil(sessionId: string, at: number | null): void {
  setEntry("waitingUntil", sessionId, at);
}
