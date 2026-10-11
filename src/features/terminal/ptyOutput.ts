import { listen } from "@tauri-apps/api/event";

import { TailBuffer } from "./ptyBuffer";

interface PtyOutputEvent {
  id: string;
  data: string;
}

const buffers = new Map<string, TailBuffer>();
const subscribers = new Map<string, Set<(data: string) => void>>();
const unclaimed = new Map<string, TailBuffer>();
let starting = 0;
let listening: Promise<void> | null = null;

function handleOutput({ id, data }: PtyOutputEvent): void {
  const buffer = buffers.get(id);
  if (buffer === undefined) {
    // The shell can print its prompt before create_pty resolves with the id.
    if (starting > 0) {
      const pending = unclaimed.get(id) ?? new TailBuffer();
      pending.append(data);
      unclaimed.set(id, pending);
    }
    return;
  }
  buffer.append(data);
  for (const listener of subscribers.get(id) ?? []) listener(data);
}

/// Records the output of editor shells outside React, so a remounted terminal can replay it.
export function ensurePtyOutputListener(): Promise<void> {
  listening ??= listen<PtyOutputEvent>("pty_output", (event) => handleOutput(event.payload)).then(
    () => undefined,
    () => undefined,
  );
  return listening;
}

/// Starts a PTY and keeps the output that arrived before its id was known.
export async function startPty(start: () => Promise<string>): Promise<string> {
  starting += 1;
  try {
    const ptyId = await start();
    buffers.set(ptyId, unclaimed.get(ptyId) ?? buffers.get(ptyId) ?? new TailBuffer());
    unclaimed.delete(ptyId);
    return ptyId;
  } finally {
    starting -= 1;
    if (starting === 0) unclaimed.clear();
  }
}

/// Replays what the PTY printed so far, then streams new output. Both happen in one step,
/// so nothing is lost or written twice.
export function attachPtyOutput(
  ptyId: string,
  onReplay: (data: string) => void,
  onData: (data: string) => void,
): () => void {
  const replay = buffers.get(ptyId)?.toString() ?? "";
  if (!buffers.has(ptyId)) buffers.set(ptyId, new TailBuffer());
  if (replay) onReplay(replay);
  const listeners = subscribers.get(ptyId) ?? new Set<(data: string) => void>();
  listeners.add(onData);
  subscribers.set(ptyId, listeners);
  return () => {
    listeners.delete(onData);
    if (listeners.size === 0 && subscribers.get(ptyId) === listeners) subscribers.delete(ptyId);
  };
}

export function releasePtyOutput(ptyId: string): void {
  buffers.delete(ptyId);
  subscribers.delete(ptyId);
}
