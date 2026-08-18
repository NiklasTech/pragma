import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { useDebugStore } from "./store";
import type { DapEventPayload } from "./debugState";

export interface DapAdapterInfo {
  id: string;
  label: string;
  available: boolean;
  install_hint?: string | null;
}

export interface DapInstallResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DapEnsureResult {
  adapterId: string;
  installed: boolean;
  available: boolean;
}

export type DapInstallStage = "downloading" | "extracting" | "installing" | "done" | "error";

export interface DapInstallProgressEvent {
  adapterId: string;
  stage: DapInstallStage;
  percent?: number | null;
  message: string;
}

export interface DapStatusEventPayload {
  status: "starting" | "running" | "stopped" | "error";
  adapter?: string | null;
  error?: string | null;
}

export interface DebugStackFrame {
  id: number;
  name: string;
  line: number;
  column: number;
  source?: { name?: string; path?: string };
}

export interface DebugScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

export interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

export interface DebugEvaluateResult {
  result: string;
  type?: string;
  variablesReference: number;
}

export interface DebugBreakpointResult {
  verified: boolean;
  line?: number;
  message?: string;
}

export type DapStartParams = {
  workspaceRoot: string;
  adapter: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  request?: "launch" | "attach";
  name?: string;
  breakpoints?: Array<{ path: string; lines: number[] }>;
};

export function dapListAdapters(): Promise<DapAdapterInfo[]> {
  return invoke("dap_list_adapters");
}

export function dapInstallAdapter(adapterId: string): Promise<DapInstallResult> {
  return invoke("dap_install_adapter", { adapterId });
}

export function dapEnsureAdapter(language: string): Promise<DapEnsureResult> {
  return invoke("dap_ensure_adapter", { language });
}

export function listenDapInstallProgress(
  handler: (event: DapInstallProgressEvent) => void,
): Promise<() => void> {
  return listen<DapInstallProgressEvent>("dap_install_progress", (event) => handler(event.payload));
}

export function dapStart(params: DapStartParams): Promise<void> {
  return invoke("dap_start", { params });
}

export function dapStop(): Promise<void> {
  return invoke("dap_stop");
}

export function dapSetBreakpoints(
  filePath: string,
  lines: number[],
): Promise<DebugBreakpointResult[]> {
  return invoke("dap_set_breakpoints", { filePath, lines });
}

export function dapContinue(threadId: number): Promise<void> {
  return invoke("dap_continue", { threadId });
}

export function dapPause(threadId: number): Promise<void> {
  return invoke("dap_pause", { threadId });
}

export function dapNext(threadId: number): Promise<void> {
  return invoke("dap_next", { threadId });
}

export function dapStepIn(threadId: number): Promise<void> {
  return invoke("dap_step_in", { threadId });
}

export function dapStepOut(threadId: number): Promise<void> {
  return invoke("dap_step_out", { threadId });
}

export function dapStackTrace(threadId: number): Promise<DebugStackFrame[]> {
  return invoke("dap_stack_trace", { threadId });
}

export function dapScopes(frameId: number): Promise<DebugScope[]> {
  return invoke("dap_scopes", { frameId });
}

export function dapVariables(variablesReference: number): Promise<DebugVariable[]> {
  return invoke("dap_variables", { variablesReference });
}

export function dapEvaluate(expression: string, frameId?: number): Promise<DebugEvaluateResult> {
  return invoke("dap_evaluate", { expression, frameId });
}

let listenersInitialized = false;

export function initDebugListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  // Debug events are broadcast to all windows from the backend; the workspace
  // window applies them to the store and floating windows receive the
  // resulting state via cross-window store sync.
  if (!isWorkspaceWindow()) return;

  void listen<DapEventPayload>("dap_event", (event) => {
    useDebugStore.getState().handleDapEvent(event.payload);
  });

  void listen<DapStatusEventPayload>("dap_status_changed", (event) => {
    useDebugStore.getState().handleStatusEvent(event.payload);
  });
}
