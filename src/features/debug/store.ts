import { create } from "zustand";
import { crossWindowSync } from "@/shared/stores/sync/crossWindowSync";
import { getWindowScope } from "@/shared/lib/windowScope";
import { useRunConfigStore, type RunConfig } from "@/shared/stores/runConfig";
import { useLayoutStore } from "@/shell/layout/store";
import {
  dapContinue,
  dapEvaluate,
  dapNext,
  dapPause,
  dapScopes,
  dapSetBreakpoints,
  dapStackTrace,
  dapStart,
  dapStepIn,
  dapStepOut,
  dapStop,
  dapVariables,
  type DapStatusEventPayload,
  type DebugScope,
  type DebugStackFrame,
  type DebugVariable,
} from "./client";
import { ensureAdapterForLanguage } from "./ensureAdapter";
import {
  loadPersistedBreakpoints,
  mapDapEvent,
  persistBreakpoints,
  sameLines,
  toFileBreakpoints,
  toggleBreakpointLine,
  type DapEventPayload,
} from "./debugState";

export type DebugSessionStatus = "inactive" | "starting" | "running" | "error";

export interface WatchEntry {
  id: string;
  expression: string;
  value?: string;
  error?: string;
}

const MAX_OUTPUT_LINES = 500;

interface DebugState {
  breakpoints: Record<string, number[]>;
  status: DebugSessionStatus;
  statusError: string | null;
  sessionName: string | null;
  sessionAdapter: string | null;
  isStopped: boolean;
  stopReason: string | null;
  stoppedThreadId: number | null;
  activeThreadId: number | null;
  frames: DebugStackFrame[];
  selectedFrameId: number | null;
  scopes: Record<number, DebugScope[]>;
  variables: Record<number, DebugVariable[]>;
  watches: WatchEntry[];
  output: string[];
}

interface DebugActions {
  toggleBreakpoint: (file: string, line: number) => void;
  syncFileBreakpoints: (file: string, lines: number[]) => void;
  startSession: (config: RunConfig) => Promise<void>;
  stopSession: () => Promise<void>;
  continueSession: () => Promise<void>;
  pauseSession: () => Promise<void>;
  stepOver: () => Promise<void>;
  stepInto: () => Promise<void>;
  stepOut: () => Promise<void>;
  selectFrame: (frameId: number) => Promise<void>;
  loadVariables: (variablesReference: number) => Promise<void>;
  addWatch: (expression: string) => void;
  removeWatch: (id: string) => void;
  handleDapEvent: (payload: DapEventPayload) => void;
  handleStatusEvent: (payload: DapStatusEventPayload) => void;
}

const initialState: DebugState = {
  breakpoints: loadPersistedBreakpoints(),
  status: "inactive",
  statusError: null,
  sessionName: null,
  sessionAdapter: null,
  isStopped: false,
  stopReason: null,
  stoppedThreadId: null,
  activeThreadId: null,
  frames: [],
  selectedFrameId: null,
  scopes: {},
  variables: {},
  watches: [],
  output: [],
};

const clearedSessionState: Partial<DebugState> = {
  isStopped: false,
  stopReason: null,
  stoppedThreadId: null,
  activeThreadId: null,
  frames: [],
  selectedFrameId: null,
  scopes: {},
  variables: {},
};

export const useDebugStore = create<DebugState & DebugActions>(
  crossWindowSync<DebugState & DebugActions>(
    "debug",
    getWindowScope(),
  )((set, get) => {
    const currentThreadId = () => get().stoppedThreadId ?? get().activeThreadId ?? 1;

    const evaluateWatches = async () => {
      const { watches, selectedFrameId, status } = get();
      if (status !== "running" || watches.length === 0) return;

      await Promise.all(
        watches.map(async (watch) => {
          try {
            const result = await dapEvaluate(watch.expression, selectedFrameId ?? undefined);
            set({
              watches: get().watches.map((w) =>
                w.id === watch.id ? { ...w, value: result.result, error: undefined } : w,
              ),
            });
          } catch (err) {
            set({
              watches: get().watches.map((w) =>
                w.id === watch.id ? { ...w, value: undefined, error: String(err) } : w,
              ),
            });
          }
        }),
      );
    };

    const loadFrameScopes = async (frameId: number) => {
      try {
        const scopes = await dapScopes(frameId);
        set({ scopes: { ...get().scopes, [frameId]: scopes } });
      } catch {
        // ignore
      }
    };

    const loadStackTrace = async (threadId: number) => {
      try {
        const frames = await dapStackTrace(threadId);
        if (!get().isStopped) return;
        const selectedFrameId = frames[0]?.id ?? null;
        set({ frames, selectedFrameId, scopes: {}, variables: {} });
        if (selectedFrameId !== null) {
          await loadFrameScopes(selectedFrameId);
        }
        await evaluateWatches();
      } catch {
        // ignore
      }
    };

    return {
      ...initialState,

      toggleBreakpoint: (file, line) => {
        const breakpoints = toggleBreakpointLine(get().breakpoints, file, line);
        set({ breakpoints });
        persistBreakpoints(breakpoints);
        if (get().status === "running") {
          void dapSetBreakpoints(file, breakpoints[file] ?? []).catch(() => {});
        }
      },

      syncFileBreakpoints: (file, lines) => {
        const current = get().breakpoints[file] ?? [];
        if (sameLines(current, lines)) return;
        const breakpoints = { ...get().breakpoints };
        if (lines.length === 0) {
          delete breakpoints[file];
        } else {
          breakpoints[file] = lines;
        }
        set({ breakpoints });
        persistBreakpoints(breakpoints);
      },

      startSession: async (config) => {
        if (!config.debug) return;
        const workspaceRoot = useRunConfigStore.getState().workspaceRoot;
        if (!workspaceRoot) return;

        const layout = useLayoutStore.getState();
        layout.setSidebarCollapsed(false);
        layout.setSidebarTab("debug");

        set({
          ...clearedSessionState,
          status: "starting",
          statusError: null,
          sessionName: config.name,
          sessionAdapter: config.debug.adapter,
          output: [],
        });

        const adapter = await ensureAdapterForLanguage(config.debug.adapter);
        if (!adapter) {
          set({ status: "error", statusError: "Debug adapter is not available" });
          return;
        }

        try {
          await dapStart({
            workspaceRoot,
            adapter: config.debug.adapter,
            command: config.command,
            cwd: config.cwd,
            env: config.env,
            request: config.debug.request ?? "launch",
            name: config.name,
            breakpoints: toFileBreakpoints(get().breakpoints),
          });
        } catch (err) {
          set({ status: "error", statusError: String(err) });
        }
      },

      stopSession: async () => {
        try {
          await dapStop();
        } catch {
          // ignore
        }
      },

      continueSession: async () => {
        if (get().status !== "running" || !get().isStopped) return;
        set({ isStopped: false });
        try {
          await dapContinue(currentThreadId());
        } catch {
          // ignore
        }
      },

      pauseSession: async () => {
        if (get().status !== "running" || get().isStopped) return;
        try {
          await dapPause(currentThreadId());
        } catch {
          // ignore
        }
      },

      stepOver: async () => {
        if (!get().isStopped) return;
        set({ isStopped: false });
        try {
          await dapNext(currentThreadId());
        } catch {
          // ignore
        }
      },

      stepInto: async () => {
        if (!get().isStopped) return;
        set({ isStopped: false });
        try {
          await dapStepIn(currentThreadId());
        } catch {
          // ignore
        }
      },

      stepOut: async () => {
        if (!get().isStopped) return;
        set({ isStopped: false });
        try {
          await dapStepOut(currentThreadId());
        } catch {
          // ignore
        }
      },

      selectFrame: async (frameId) => {
        set({ selectedFrameId: frameId });
        if (!get().scopes[frameId]) {
          await loadFrameScopes(frameId);
        }
        await evaluateWatches();
      },

      loadVariables: async (variablesReference) => {
        if (get().variables[variablesReference]) return;
        try {
          const variables = await dapVariables(variablesReference);
          set({ variables: { ...get().variables, [variablesReference]: variables } });
        } catch {
          // ignore
        }
      },

      addWatch: (expression) => {
        const trimmed = expression.trim();
        if (!trimmed) return;
        set({
          watches: [...get().watches, { id: crypto.randomUUID(), expression: trimmed }],
        });
        void evaluateWatches();
      },

      removeWatch: (id) => {
        set({ watches: get().watches.filter((w) => w.id !== id) });
      },

      handleDapEvent: (payload) => {
        const effect = mapDapEvent(payload);

        if (effect.appendOutput) {
          const output = [...get().output, effect.appendOutput];
          set({ output: output.slice(-MAX_OUTPUT_LINES) });
        }

        if (effect.sessionEnded) {
          set({ ...clearedSessionState });
          return;
        }

        if (effect.isStopped) {
          const threadId = effect.stoppedThreadId ?? get().activeThreadId ?? 1;
          set({
            isStopped: true,
            stopReason: effect.stopReason ?? null,
            stoppedThreadId: threadId,
            activeThreadId: threadId,
          });
          void loadStackTrace(threadId);
        } else if (effect.isStopped === false) {
          set({
            isStopped: false,
            stopReason: null,
            frames: [],
            selectedFrameId: null,
            scopes: {},
            variables: {},
          });
        }
      },

      handleStatusEvent: (payload) => {
        switch (payload.status) {
          case "starting":
            set({ status: "starting", statusError: null });
            break;
          case "running":
            set({ status: "running", statusError: null });
            break;
          case "stopped":
            set({
              ...clearedSessionState,
              status: "inactive",
              statusError: null,
              sessionName: null,
              sessionAdapter: null,
            });
            break;
          case "error":
            set({
              ...clearedSessionState,
              status: "error",
              statusError: payload.error ?? null,
            });
            break;
        }
      },
    };
  }),
);
