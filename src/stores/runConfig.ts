import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface RunConfig {
  name: string;
  command: string;
  cwd?: string;
  env: Record<string, string>;
  autostart: boolean;
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
  processes: RunProcess[];
  activeProcessId: string | null;
  workspaceRoot: string;
  isLoading: boolean;
}

interface RunConfigActions {
  setWorkspaceRoot: (root: string) => void;
  loadConfigs: () => Promise<void>;
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
  processes: [],
  activeProcessId: null,
  workspaceRoot: "",
  isLoading: false,
};

export const useRunConfigStore = create<RunConfigState & RunConfigActions>((set, get) => ({
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
    const { processes, workspaceRoot } = get();
    const process = processes.find((p) => p.id === processId);
    if (!process || !workspaceRoot) return;

    const config = get().configs.find((c) => c.name === process.configName);
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
      processes: get().processes.map((p) => (p.id === processId ? { ...p, status, exitCode } : p)),
    });
  },

  removeProcess: (processId) => {
    set({
      processes: get().processes.filter((p) => p.id !== processId),
      activeProcessId: get().activeProcessId === processId ? null : get().activeProcessId,
    });
  },
}));

// ─── Event Listeners ─────────────────────────────────────────────────────────

let listenersInitialized = false;

export function initRunConfigListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

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
