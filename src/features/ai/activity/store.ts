import { create } from "zustand";

import type { SessionOutcome, StateEntry } from "./dashboard";

interface ActivityState {
  entries: Readonly<Record<string, StateEntry>>;
  /** Runs that ended while the user was not looking at the session. */
  outcomes: Readonly<Record<string, SessionOutcome>>;
  terminalWorking: Readonly<Record<string, true>>;
}

export const useActivityStore = create<ActivityState>()(() => ({
  entries: {},
  outcomes: {},
  terminalWorking: {},
}));

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function setOutcome(sessionId: string, outcome: SessionOutcome): boolean {
  const { outcomes } = useActivityStore.getState();
  if (outcomes[sessionId] === outcome) return false;
  useActivityStore.setState({ outcomes: { ...outcomes, [sessionId]: outcome } });
  return true;
}

export function clearOutcome(sessionId: string): boolean {
  const { outcomes } = useActivityStore.getState();
  if (!(sessionId in outcomes)) return false;
  useActivityStore.setState({ outcomes: without(outcomes, sessionId) });
  return true;
}

export function setTerminalWorking(sessionId: string, working: boolean): boolean {
  const { terminalWorking } = useActivityStore.getState();
  if (working === sessionId in terminalWorking) return false;
  useActivityStore.setState({
    terminalWorking: working
      ? { ...terminalWorking, [sessionId]: true }
      : without(terminalWorking, sessionId),
  });
  return true;
}
