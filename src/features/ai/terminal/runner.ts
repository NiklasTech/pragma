import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { appendTerminalBuffer } from "./buffer";
import { decideTerminalStop } from "./stop";

interface PtyOutputEvent {
  id: string;
  data: string;
}

interface PtyExitEvent {
  id: string;
  exit_code: number;
}

export type TerminalStatus = "running" | "exited" | "cancelled";

interface TerminalEntry {
  sessionId: string;
  ptyId: string | null;
  command: string;
  cwd: string | null;
  buffer: string;
  status: TerminalStatus;
  exitCode: number | null;
  lastInterruptAt: number | null;
}

export interface StartTerminalOptions {
  command: string;
  cwd: string | null;
  cols: number;
  rows: number;
}

const entries = new Map<string, TerminalEntry>();
const starting = new Map<string, Promise<void>>();
const outputListeners = new Map<string, Set<(data: string) => void>>();
const statusListeners = new Map<string, Set<() => void>>();
const unclaimedOutput = new Map<string, string>();
const unclaimedExit = new Map<string, number>();

let globalListeners: Promise<void> | null = null;

function ensureGlobalListeners(): Promise<void> {
  if (!globalListeners) {
    globalListeners = (async () => {
      try {
        await listen<PtyOutputEvent>("pty_output", (event) => {
          handleOutput(event.payload.id, event.payload.data);
        });
        await listen<PtyExitEvent>("pty_exit", (event) => {
          handleExit(event.payload.id, event.payload.exit_code);
        });
      } catch {
        // Tauri is unavailable outside the desktop runtime.
      }
    })();
  }
  return globalListeners;
}

function findByPtyId(ptyId: string): TerminalEntry | null {
  for (const entry of entries.values()) {
    if (entry.ptyId === ptyId) return entry;
  }
  return null;
}

function pushOutput(entry: TerminalEntry, data: string): void {
  entry.buffer = appendTerminalBuffer(entry.buffer, data);
  const listeners = outputListeners.get(entry.sessionId);
  if (!listeners) return;
  for (const listener of listeners) listener(data);
}

function notifyStatus(sessionId: string): void {
  const listeners = statusListeners.get(sessionId);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function applyExit(entry: TerminalEntry, exitCode: number): void {
  if (entry.status === "cancelled") return;
  entry.status = "exited";
  entry.exitCode = exitCode;
  notifyStatus(entry.sessionId);
}

function handleOutput(ptyId: string, data: string): void {
  const entry = findByPtyId(ptyId);
  if (entry) {
    pushOutput(entry, data);
    return;
  }
  // Output that races ahead of create_pty_command belongs to a terminal that
  // is still starting. Editor terminal PTYs are ignored outside that window.
  if (starting.size === 0) return;
  unclaimedOutput.set(ptyId, appendTerminalBuffer(unclaimedOutput.get(ptyId) ?? "", data));
}

function handleExit(ptyId: string, exitCode: number): void {
  const entry = findByPtyId(ptyId);
  if (entry) {
    applyExit(entry, exitCode);
    return;
  }
  if (starting.size === 0) return;
  unclaimedExit.set(ptyId, exitCode);
}

export function getTerminalBuffer(sessionId: string): string {
  return entries.get(sessionId)?.buffer ?? "";
}

export function resetTerminalBuffer(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.buffer = "";
}

export function getTerminalStatus(sessionId: string): {
  status: TerminalStatus;
  exitCode: number | null;
} {
  const entry = entries.get(sessionId);
  return { status: entry?.status ?? "running", exitCode: entry?.exitCode ?? null };
}

export function getTerminalEntryStatus(sessionId: string): TerminalStatus | null {
  return entries.get(sessionId)?.status ?? null;
}

export function subscribeTerminalOutput(
  sessionId: string,
  listener: (data: string) => void,
): () => void {
  const listeners = outputListeners.get(sessionId) ?? new Set<(data: string) => void>();
  outputListeners.set(sessionId, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) outputListeners.delete(sessionId);
  };
}

export function subscribeTerminalStatus(sessionId: string, listener: () => void): () => void {
  const listeners = statusListeners.get(sessionId) ?? new Set<() => void>();
  statusListeners.set(sessionId, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) statusListeners.delete(sessionId);
  };
}

export async function writeTerminal(sessionId: string, data: string): Promise<void> {
  const entry = entries.get(sessionId);
  if (!entry?.ptyId) return;
  try {
    await invoke("write_pty", { id: entry.ptyId, data });
  } catch {
    // The PTY may have exited between the click and the write.
  }
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
  const entry = entries.get(sessionId);
  if (!entry?.ptyId) return;
  try {
    await invoke("resize_pty", {
      id: entry.ptyId,
      rows: Math.max(rows, 2),
      cols: Math.max(cols, 10),
    });
  } catch {
    // The PTY may have exited between the resize and the call.
  }
}

export async function ensureTerminal(
  sessionId: string,
  options: StartTerminalOptions,
): Promise<void> {
  let entry = entries.get(sessionId);
  if (!entry) {
    entry = {
      sessionId,
      ptyId: null,
      command: options.command,
      cwd: options.cwd,
      buffer: "",
      status: "running",
      exitCode: null,
      lastInterruptAt: null,
    };
    entries.set(sessionId, entry);
  }

  await ensureGlobalListeners();
  if (!options.command) return;

  if (entry.ptyId) {
    await resizeTerminal(sessionId, options.cols, options.rows);
    return;
  }

  const existingStart = starting.get(sessionId);
  if (existingStart) {
    await existingStart;
    await resizeTerminal(sessionId, options.cols, options.rows);
    return;
  }

  const current = entry;
  const start = (async () => {
    try {
      const ptyId = await invoke<string>("create_pty_command", {
        command: current.command,
        cwd: current.cwd,
        cols: Math.max(options.cols, 10),
        rows: Math.max(options.rows, 2),
      });
      current.ptyId = ptyId;

      const pendingOutput = unclaimedOutput.get(ptyId);
      if (pendingOutput !== undefined) {
        unclaimedOutput.delete(ptyId);
        pushOutput(current, pendingOutput);
      }
      const pendingExit = unclaimedExit.get(ptyId);
      if (pendingExit !== undefined) {
        unclaimedExit.delete(ptyId);
        applyExit(current, pendingExit);
      }

      if (current.status === "cancelled") {
        void invoke("kill_pty", { id: ptyId }).catch(() => {});
      }
    } catch (err) {
      pushOutput(current, `\r\nFailed to start ${current.command}: ${String(err)}\r\n`);
      current.status = "exited";
      current.exitCode = -1;
      notifyStatus(sessionId);
    }
  })();

  starting.set(sessionId, start);
  try {
    await start;
  } finally {
    starting.delete(sessionId);
    if (starting.size === 0) {
      unclaimedOutput.clear();
      unclaimedExit.clear();
    }
  }
}

export function requestTerminalStop(sessionId: string, now: number = Date.now()): void {
  const entry = entries.get(sessionId);
  if (!entry || entry.status !== "running") return;

  if (decideTerminalStop(entry.lastInterruptAt, now) === "kill") {
    cancelTerminal(sessionId);
    return;
  }

  entry.lastInterruptAt = now;
  void writeTerminal(sessionId, "\x03");
}

export function cancelTerminal(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.status = "cancelled";
  notifyStatus(sessionId);
  if (entry.ptyId) {
    void invoke("kill_pty", { id: entry.ptyId }).catch(() => {});
  }
}

export function disposeTerminal(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (entry?.ptyId) {
    void invoke("kill_pty", { id: entry.ptyId }).catch(() => {});
  }
  entries.delete(sessionId);
  starting.delete(sessionId);
  outputListeners.delete(sessionId);
  statusListeners.delete(sessionId);
}
