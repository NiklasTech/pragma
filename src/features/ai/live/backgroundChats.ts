import { create } from "zustand";

interface BackgroundChatsState {
  /** Sessions whose chat still answers while no pane shows it. */
  running: readonly string[];
}

export const useBackgroundChatsStore = create<BackgroundChatsState>()(() => ({ running: [] }));

const stops = new Map<string, () => void>();

export function addBackgroundChat(sessionId: string, stop: () => void): void {
  stops.set(sessionId, stop);
  useBackgroundChatsStore.setState((state) =>
    state.running.includes(sessionId) ? {} : { running: [...state.running, sessionId] },
  );
}

export function removeBackgroundChat(sessionId: string): void {
  stops.delete(sessionId);
  useBackgroundChatsStore.setState((state) =>
    state.running.includes(sessionId)
      ? { running: state.running.filter((id) => id !== sessionId) }
      : {},
  );
}

/** Stops a chat that answers without a pane; false when the session has none. */
export function stopBackgroundChat(sessionId: string): boolean {
  const stop = stops.get(sessionId);
  if (!stop) return false;
  stop();
  return true;
}
