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
import {
  loadPersistedBreakpointSettings,
  normalizeBreakpointSettings,
  persistBreakpointSettings,
  remapFileSettings,
  setLineSettings,
  toSourceBreakpoints,
  type BreakpointSettings,
  type BreakpointSettingsMap,
} from "./breakpointSettings";
import {
  appendConsoleEntry,
  outputEntryKind,
  pushConsoleHistory,
  type ConsoleEntry,
} from "./debugConsole";

export type DebugSessionStatus = "inactive" | "starting" | "running" | "error";

export interface WatchEntry {
  id: string;
  expression: string;
  value?: string;
  error?: string;
}

interface DebugState {
  breakpoints: Record<string, number[]>;
  breakpointSettings: BreakpointSettingsMap;
  status: DebugSessionStatus;
  statusError: string | null;
  sessionName: string | null;
  isStopped: boolean;
  stopReason: string | null;
  stoppedThreadId: number | null;
  frames: DebugStackFrame[];
  selectedFrameId: number | null;
  scopes: Record<number, DebugScope[]>;
  variables: Record<number, DebugVariable[]>;
  watches: WatchEntry[];
  consoleEntries: ConsoleEntry[];
  consoleHistory: string[];
}

interface DebugActions {
  toggleBreakpoint: (file: string, line: number) => void;
  syncFileBreakpoints: (file: string, lines: number[]) => void;
  setBreakpointSettings: (file: string, line: number, settings: BreakpointSettings) => void;
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
  evaluateInConsole: (expression: string) => Promise<void>;
  clearConsole: () => void;
  handleDapEvent: (payload: DapEventPayload) => void;
  handleStatusEvent: (payload: DapStatusEventPayload) => void;
}

const initialState: DebugState = {
  breakpoints: loadPersistedBreakpoints(),
  breakpointSettings: loadPersistedBreakpointSettings(),
  status: "inactive",
  statusError: null,
  sessionName: null,
  isStopped: false,
  stopReason: null,
  stoppedThreadId: null,
  frames: [],
  selectedFrameId: null,
  scopes: {},
  variables: {},
  watches: [],
  consoleEntries: [],
  consoleHistory: [],
};

const clearedSessionState: Partial<DebugState> = {
  isStopped: false,
  stopReason: null,
  stoppedThreadId: null,
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
    const currentThreadId = () => get().stoppedThreadId ?? 1;

    const sendFileBreakpoints = (file: string) => {
      if (get().status !== "running") return;
      const { breakpoints, breakpointSettings } = get();
      void dapSetBreakpoints(
        file,
        toSourceBreakpoints(breakpoints[file] ?? [], breakpointSettings[file]),
      ).catch(() => {});
    };

    const updateBreakpointSettings = (breakpointSettings: BreakpointSettingsMap) => {
      set({ breakpointSettings });
      persistBreakpointSettings(breakpointSettings);
    };

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
        if (!breakpoints[file]?.includes(line) && get().breakpointSettings[file]?.[line]) {
          updateBreakpointSettings(setLineSettings(get().breakpointSettings, file, line, null));
        }
        sendFileBreakpoints(file);
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

        const fileSettings = get().breakpointSettings[file];
        if (fileSettings) {
          const remapped = remapFileSettings(fileSettings, current, lines);
          const breakpointSettings = { ...get().breakpointSettings };
          if (Object.keys(remapped).length === 0) {
            delete breakpointSettings[file];
          } else {
            breakpointSettings[file] = remapped;
          }
          updateBreakpointSettings(breakpointSettings);
        }
      },

      setBreakpointSettings: (file, line, settings) => {
        const current = get().breakpoints[file] ?? [];
        if (!current.includes(line)) {
          const breakpoints = toggleBreakpointLine(get().breakpoints, file, line);
          set({ breakpoints });
          persistBreakpoints(breakpoints);
        }
        updateBreakpointSettings(
          setLineSettings(
            get().breakpointSettings,
            file,
            line,
            normalizeBreakpointSettings(settings),
          ),
        );
        sendFileBreakpoints(file);
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
          consoleEntries: [],
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
            breakpoints: toFileBreakpoints(get().breakpoints, get().breakpointSettings),
            args: config.debug.args,
            host: config.debug.host,
            port: config.debug.port,
            processId: config.debug.processId,
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

      evaluateInConsole: async (expression) => {
        const trimmed = expression.trim();
        if (!trimmed) return;
        set({
          consoleEntries: appendConsoleEntry(get().consoleEntries, "input", trimmed),
          consoleHistory: pushConsoleHistory(get().consoleHistory, trimmed),
        });
        if (get().status !== "running") {
          set({
            consoleEntries: appendConsoleEntry(
              get().consoleEntries,
              "error",
              "No active debug session",
            ),
          });
          return;
        }
        try {
          const result = await dapEvaluate(trimmed, get().selectedFrameId ?? undefined, "repl");
          set({
            consoleEntries: appendConsoleEntry(get().consoleEntries, "result", result.result),
          });
        } catch (err) {
          set({ consoleEntries: appendConsoleEntry(get().consoleEntries, "error", String(err)) });
        }
      },

      clearConsole: () => {
        set({ consoleEntries: [] });
      },

      handleDapEvent: (payload) => {
        const effect = mapDapEvent(payload);

        if (effect.appendOutput) {
          set({
            consoleEntries: appendConsoleEntry(
              get().consoleEntries,
              outputEntryKind(effect.outputCategory),
              effect.appendOutput,
            ),
          });
        }

        if (effect.sessionEnded) {
          set({ ...clearedSessionState });
          return;
        }

        if (effect.isStopped) {
          const threadId = effect.stoppedThreadId ?? 1;
          set({
            isStopped: true,
            stopReason: effect.stopReason ?? null,
            stoppedThreadId: threadId,
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
