import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { isCursorQueryOnly } from "@/features/terminal/cursorQueries";

import { isAgentOutput } from "./activity";
import {
  createAttentionParser,
  type PragmaReport,
  type TerminalAttention,
} from "./attentionSignals";
import { appendTerminalBuffer } from "./buffer";
import { nextPasteMode, PASTE_MODE_OFF, type PasteModeState } from "./pasteMode";

interface PtyOutputEvent {
  id: string;
  data: string;
}

interface PtyExitEvent {
  id: string;
  exit_code: number;
}

export type TerminalStatus = "running" | "exited" | "cancelled";

export type TerminalAttentionKind = TerminalAttention | "failed";

/// A CLI that signals through its own channel and a Pragma hook reports one event only once.
const ATTENTION_DEDUPE_MS = 2000;

interface TerminalEntry {
  sessionId: string;
  ptyId: string | null;
  command: string;
  /** Set for a shell pane: the shell to start instead of a CLI command. */
  shell: string | null;
  cwd: string | null;
  account: TerminalAccount | null;
  buffer: string;
  status: TerminalStatus;
  exitCode: number | null;
  lastInputAt: number;
  readAttention: (data: string) => TerminalAttention[];
  lastAttentionAt: number;
  pasteMode: PasteModeState;
  /** The id the CLI gave its own session, reported by a Pragma hook. */
  cliSessionId: string | null;
}

/** Starts the CLI with this account's config folder instead of its default one. */
export interface TerminalAccount {
  providerId: string;
  configDir: string;
}

export interface StartTerminalOptions {
  command: string;
  /** Starts this shell like the code tab terminal does, instead of running `command`. */
  shell?: string | null;
  cwd: string | null;
  account?: TerminalAccount | null;
  cols: number;
  rows: number;
}

const entries = new Map<string, TerminalEntry>();
const starting = new Map<string, Promise<void>>();
const outputListeners = new Map<string, Set<(data: string) => void>>();
const statusListeners = new Map<string, Set<() => void>>();
const anyOutputListeners = new Set<(sessionId: string) => void>();
const anyStatusListeners = new Set<(sessionId: string) => void>();
const attentionListeners = new Set<(sessionId: string, kind: TerminalAttentionKind) => void>();
const limitListeners = new Set<(sessionId: string) => void>();
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

function handleReport(sessionId: string, report: PragmaReport): void {
  if (report.kind === "limit") {
    for (const listener of limitListeners) listener(sessionId);
    return;
  }
  const entry = entries.get(sessionId);
  if (entry) entry.cliSessionId = report.id;
}

function emitAttention(sessionId: string, kind: TerminalAttentionKind): void {
  for (const listener of attentionListeners) listener(sessionId, kind);
}

function detectAttention(entry: TerminalEntry, data: string): void {
  const signals = entry.readAttention(data);
  const now = Date.now();
  if (signals.length === 0 || !isAgentOutput(now, entry.lastInputAt)) return;
  if (now - entry.lastAttentionAt < ATTENTION_DEDUPE_MS) return;
  entry.lastAttentionAt = now;
  emitAttention(entry.sessionId, signals[signals.length - 1]);
}

function pushOutput(entry: TerminalEntry, data: string): void {
  // A replayed cursor query would send the CLI a stale answer, and polling would fill the buffer.
  if (!isCursorQueryOnly(data)) entry.buffer = appendTerminalBuffer(entry.buffer, data);
  entry.pasteMode = nextPasteMode(entry.pasteMode, data);
  detectAttention(entry, data);
  for (const listener of anyOutputListeners) listener(entry.sessionId);
  const listeners = outputListeners.get(entry.sessionId);
  if (!listeners) return;
  for (const listener of listeners) listener(data);
}

function notifyStatus(sessionId: string): void {
  for (const listener of anyStatusListeners) listener(sessionId);
  const listeners = statusListeners.get(sessionId);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function applyExit(entry: TerminalEntry, exitCode: number): void {
  if (entry.status === "cancelled") return;
  entry.status = "exited";
  entry.exitCode = exitCode;
  notifyStatus(entry.sessionId);
  if (exitCode !== 0) emitAttention(entry.sessionId, "failed");
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

/// Output of every agent terminal, including ones that start or restart after subscribing.
export function subscribeAnyTerminalOutput(listener: (sessionId: string) => void): () => void {
  anyOutputListeners.add(listener);
  return () => {
    anyOutputListeners.delete(listener);
  };
}

export function subscribeAnyTerminalStatus(listener: (sessionId: string) => void): () => void {
  anyStatusListeners.add(listener);
  return () => {
    anyStatusListeners.delete(listener);
  };
}

/// Bells, desktop notifications and failed exits of every agent terminal.
export function subscribeTerminalAttention(
  listener: (sessionId: string, kind: TerminalAttentionKind) => void,
): () => void {
  attentionListeners.add(listener);
  return () => {
    attentionListeners.delete(listener);
  };
}

/// The CLI's own id for the session in this terminal, once a Pragma hook reported it.
export function getTerminalCliSessionId(sessionId: string): string | null {
  return entries.get(sessionId)?.cliSessionId ?? null;
}

/// Calls the listener when the CLI in a terminal stops at its usage limit.
export function subscribeTerminalLimit(listener: (sessionId: string) => void): () => void {
  limitListeners.add(listener);
  return () => {
    limitListeners.delete(listener);
  };
}

/// When the user last typed into the terminal, so the echo of typing is not read as agent work.
export function getTerminalLastInputAt(sessionId: string): number {
  return entries.get(sessionId)?.lastInputAt ?? 0;
}

/// Whether the CLI asked for bracketed paste, so text with line breaks reaches it as one paste.
export function isTerminalBracketedPaste(sessionId: string): boolean {
  return entries.get(sessionId)?.pasteMode.on ?? false;
}

export async function writeTerminal(sessionId: string, data: string): Promise<void> {
  const entry = entries.get(sessionId);
  if (!entry?.ptyId) return;
  entry.lastInputAt = Date.now();
  try {
    await invoke("write_pty", { id: entry.ptyId, data });
  } catch {
    // The PTY may have exited between the click and the write.
  }
}

const sizes = new Map<string, { cols: number; rows: number }>();

/** The size the PTY was last given, so a second view can hand it back when it closes. */
export function getTerminalSize(sessionId: string): { cols: number; rows: number } | null {
  return sizes.get(sessionId) ?? null;
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
  const entry = entries.get(sessionId);
  if (!entry?.ptyId) return;
  sizes.set(sessionId, { cols, rows });
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
      shell: options.shell ?? null,
      cwd: options.cwd,
      account: options.account ?? null,
      buffer: "",
      status: "running",
      exitCode: null,
      lastInputAt: 0,
      readAttention: createAttentionParser((report) => handleReport(sessionId, report)),
      lastAttentionAt: 0,
      pasteMode: PASTE_MODE_OFF,
      cliSessionId: null,
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
      const size = { cols: Math.max(options.cols, 10), rows: Math.max(options.rows, 2) };
      const ptyId =
        current.shell !== null
          ? await invoke<string>("create_pty", {
              shell: current.shell || null,
              cwd: current.cwd,
              ...size,
            })
          : await invoke<string>("create_pty_command", {
              command: current.command,
              cwd: current.cwd,
              account: current.account,
              ...size,
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

/** The PTY behind a session's terminal, once it has started. */
export function getTerminalPtyId(sessionId: string): string | null {
  return entries.get(sessionId)?.ptyId ?? null;
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
