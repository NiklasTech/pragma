import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { crossWindowSync } from "./sync/crossWindowSync";

export interface RunConfig {
  id?: string;
  name: string;
  command: string;
  cwd?: string;
  env: Record<string, string>;
  autostart: boolean;
  autoRestart: boolean;
  icon?: string;
  detect?: string;
}

export type RunStatus = "running" | "failed" | "stopped";

export interface RunProcess {
  id: string;
  configName: string;
  status: RunStatus;
  exitCode: number | null;
  output: string[];
}

interface RunConfigState {
  configs: RunConfig[];
  detectedConfigs: RunConfig[];
  processes: RunProcess[];
  activeProcessId: string | null;
  workspaceRoot: string;
  isLoading: boolean;
  isDetecting: boolean;
}

interface RunConfigActions {
  setWorkspaceRoot: (root: string) => void;
  loadConfigs: () => Promise<void>;
  detectConfigs: () => Promise<void>;
  saveConfigs: () => Promise<void>;
  addConfig: (config: RunConfig) => void;
  updateConfig: (id: string, config: Partial<RunConfig>) => void;
  removeConfig: (id: string) => void;
  acceptDetectedConfig: (index: number) => void;
  rejectDetectedConfig: (index: number) => void;
  startConfig: (config: RunConfig) => Promise<void>;
  stopProcess: (processId: string) => Promise<void>;
  restartProcess: (processId: string) => Promise<void>;
  setActiveProcess: (processId: string | null) => void;
  appendOutput: (processId: string, data: string) => void;
  setProcessStatus: (processId: string, status: RunStatus, exitCode: number | null) => void;
  removeProcess: (processId: string) => void;
}

const initialState: RunConfigState = {
  configs: [],
  detectedConfigs: [],
  processes: [],
  activeProcessId: null,
  workspaceRoot: "",
  isLoading: false,
  isDetecting: false,
};

export const useRunConfigStore = create<RunConfigState & RunConfigActions>(
  crossWindowSync<RunConfigState & RunConfigActions>("runConfig")((set, get) => ({
    ...initialState,

    setWorkspaceRoot: (root) => set({ workspaceRoot: root }),

    loadConfigs: async () => {
      const { workspaceRoot } = get();
      if (!workspaceRoot) return;

      set({ isLoading: true });
      try {
        const configs = await invoke<RunConfig[]>("run_list_configs", {
          workspaceRoot,
        });
        set({ configs, isLoading: false });
      } catch {
        set({ configs: [], isLoading: false });
      }
    },

    detectConfigs: async () => {
      const { workspaceRoot } = get();
      if (!workspaceRoot) return;

      set({ isDetecting: true });
      try {
        const [saved, detected] = await Promise.all([
          invoke<RunConfig[]>("run_list_configs", { workspaceRoot }),
          invoke<RunConfig[]>("run_detect_configs", { workspaceRoot }),
        ]);

        const savedNames = new Set(saved.map((c) => c.name));
        const newDetected = detected.filter((c) => !savedNames.has(c.name));

        set({ configs: saved, detectedConfigs: newDetected, isDetecting: false });
      } catch {
        set({ isDetecting: false });
      }
    },

    saveConfigs: async () => {
      const { workspaceRoot, configs } = get();
      if (!workspaceRoot) return;

      try {
        await invoke("run_save_configs", { workspaceRoot, configs });
      } catch {
        // ignore
      }
    },

    addConfig: (config) => {
      const { configs, saveConfigs } = get();
      if (configs.some((c) => c.name === config.name)) return;
      set({ configs: [...configs, config] });
      void saveConfigs();
    },

    updateConfig: (id, updates) => {
      const { configs, saveConfigs } = get();
      set({
        configs: configs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      });
      void saveConfigs();
    },

    removeConfig: (id) => {
      const { configs, saveConfigs } = get();
      set({ configs: configs.filter((c) => c.id !== id) });
      void saveConfigs();
    },

    acceptDetectedConfig: (index) => {
      const { detectedConfigs, configs, saveConfigs } = get();
      const config = detectedConfigs[index];
      if (!config) return;

      set({
        configs: [...configs, { ...config, id: crypto.randomUUID() }],
        detectedConfigs: detectedConfigs.filter((_, i) => i !== index),
      });
      void saveConfigs();
    },

    rejectDetectedConfig: (index) => {
      const { detectedConfigs } = get();
      set({ detectedConfigs: detectedConfigs.filter((_, i) => i !== index) });
    },

    startConfig: async (config) => {
      const { workspaceRoot, processes } = get();
      if (!workspaceRoot) return;

      try {
        const processId = await invoke<string>("run_start", {
          workspaceRoot,
          config,
        });

        const newProcess: RunProcess = {
          id: processId,
          configName: config.name,
          status: "running",
          exitCode: null,
          output: [],
        };

        set({
          processes: [...processes, newProcess],
          activeProcessId: processId,
        });
      } catch (err) {
        const errorProcess: RunProcess = {
          id: `error-${Date.now()}`,
          configName: config.name,
          status: "failed",
          exitCode: null,
          output: [`Failed to start: ${String(err)}`],
        };
        set({
          processes: [...get().processes, errorProcess],
          activeProcessId: errorProcess.id,
        });
      }
    },

    stopProcess: async (processId) => {
      try {
        await invoke("run_stop", { processId });
      } catch {
        // ignore
      }

      set({
        processes: get().processes.map((p) =>
          p.id === processId ? { ...p, status: "stopped" as RunStatus } : p,
        ),
      });
    },

    restartProcess: async (processId) => {
      const { processes, workspaceRoot, configs } = get();
      const process = processes.find((p) => p.id === processId);
      if (!process || !workspaceRoot) return;

      const config = configs.find((c) => c.name === process.configName);
      if (!config) return;

      try {
        await invoke("run_stop", { processId });
      } catch {
        // ignore
      }

      set({
        processes: processes.filter((p) => p.id !== processId),
        activeProcessId: get().activeProcessId === processId ? null : get().activeProcessId,
      });

      await get().startConfig(config);
    },

    setActiveProcess: (processId) => set({ activeProcessId: processId }),

    appendOutput: (processId, data) => {
      set({
        processes: get().processes.map((p) =>
          p.id === processId ? { ...p, output: [...p.output, data] } : p,
        ),
      });
    },

    setProcessStatus: (processId, status, exitCode) => {
      set({
        processes: get().processes.map((p) =>
          p.id === processId ? { ...p, status, exitCode } : p,
        ),
      });
    },

    removeProcess: (processId) => {
      set({
        processes: get().processes.filter((p) => p.id !== processId),
        activeProcessId: get().activeProcessId === processId ? null : get().activeProcessId,
      });
    },
  })),
);

// ─── Event Listeners ─────────────────────────────────────────────────────────

let listenersInitialized = false;

export function initRunConfigListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  // Run output events are already broadcast to all windows from the backend.
  // Only the main window needs to append them; external windows receive the
  // resulting state via cross-window store sync.
  if (getCurrentWindow().label !== "main") return;

  void listen<{ process_id: string; data: string }>("run_output", (event) => {
    useRunConfigStore.getState().appendOutput(event.payload.process_id, event.payload.data);
  });

  void listen<{
    process_id: string;
    status: RunStatus;
    exit_code: number | null;
  }>("run_status_changed", (event) => {
    useRunConfigStore
      .getState()
      .setProcessStatus(event.payload.process_id, event.payload.status, event.payload.exit_code);
  });
}
