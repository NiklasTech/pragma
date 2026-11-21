import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { getTerminalPtyId } from "./runner";

/// How often the watched shells are asked which program runs in their foreground.
export const FOREGROUND_POLL_MS = 1200;

interface ForegroundState {
  /** Session id of a watched shell to the names of its foreground program; absent while it waits. */
  names: Record<string, readonly string[]>;
}

export const useForegroundStore = create<ForegroundState>()(() => ({ names: {} }));

const watchers = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let polling = false;

function sameNames(a: readonly string[] | undefined, b: readonly string[] | null): boolean {
  if (!a || !b) return !a && !b;
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

async function foregroundOf(sessionId: string): Promise<string[] | null> {
  const ptyId = getTerminalPtyId(sessionId);
  if (!ptyId) return null;
  try {
    return await invoke<string[] | null>("pty_foreground_process", { id: ptyId });
  } catch {
    // The terminal may have closed between two checks.
    return null;
  }
}

function store(sessionId: string, found: string[] | null): void {
  const current = useForegroundStore.getState().names;
  if (!watchers.has(sessionId) || sameNames(current[sessionId], found)) return;
  const names = { ...current };
  if (found) names[sessionId] = found;
  else delete names[sessionId];
  useForegroundStore.setState({ names });
}

async function pollAll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const ids = [...watchers.keys()];
    const results = await Promise.all(ids.map(foregroundOf));
    ids.forEach((id, index) => store(id, results[index]));
  } finally {
    polling = false;
  }
}

/// Watches the foreground program of a shell; every watcher of a session shares one check per tick.
export function watchForeground(sessionId: string): () => void {
  watchers.set(sessionId, (watchers.get(sessionId) ?? 0) + 1);
  timer ??= setInterval(() => void pollAll(), FOREGROUND_POLL_MS);
  void foregroundOf(sessionId).then((found) => store(sessionId, found));

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const left = (watchers.get(sessionId) ?? 1) - 1;
    if (left > 0) {
      watchers.set(sessionId, left);
      return;
    }
    store(sessionId, null);
    watchers.delete(sessionId);
    if (watchers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
