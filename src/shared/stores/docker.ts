import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useTerminalStore } from "./terminal";

export interface DockerContainer {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
  labels: Record<string, string>;
}

export interface RuntimeInfo {
  runtime: string;
  binary_path: string;
  version: string;
  available: boolean;
  daemon_error: string | null;
  compose_available: boolean;
  compose_file: string | null;
  compose_project_name: string | null;
}

interface DockerState {
  containers: DockerContainer[];
  runtime: RuntimeInfo | null;
  isLoading: boolean;
  runtimeLoading: boolean;
  actionBusy: string | null;
  error: string | null;
  workspaceRoot: string;
}

interface DockerActions {
  setWorkspaceRoot: (root: string) => void;
  loadContainers: () => Promise<void>;
  loadRuntimeInfo: () => Promise<void>;
  startContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  restartContainer: (id: string) => Promise<void>;
  composeUp: () => Promise<void>;
  composeUpBuild: () => Promise<void>;
  composeDown: () => Promise<void>;
  composeBuild: () => Promise<void>;
  composeRestart: () => Promise<void>;
  openLogsTab: (container: DockerContainer) => void;
  openExecTab: (container: DockerContainer, shell?: string) => void;
}

const initialState: DockerState = {
  containers: [],
  runtime: null,
  isLoading: false,
  runtimeLoading: false,
  actionBusy: null,
  error: null,
  workspaceRoot: "",
};

function firstName(container: DockerContainer): string {
  return container.names[0] ?? container.id.slice(0, 12);
}

export const useDockerStore = create<DockerState & DockerActions>((set, get) => ({
  ...initialState,

  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),

  loadContainers: async () => {
    set({ isLoading: true, error: null });
    try {
      const containers = await invoke<DockerContainer[]>("docker_list_containers");
      set({ containers, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadRuntimeInfo: async () => {
    const { workspaceRoot } = get();
    set({ runtimeLoading: true });
    try {
      const runtime = await invoke<RuntimeInfo>("docker_runtime_info", {
        req: { workspaceRoot: workspaceRoot || null },
      });
      set({ runtime, runtimeLoading: false });
    } catch (err) {
      set({ runtime: null, runtimeLoading: false, error: String(err) });
    }
  },

  startContainer: async (id) => {
    set({ actionBusy: `start-${id}` });
    try {
      await invoke("docker_start_container", { id });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  stopContainer: async (id) => {
    set({ actionBusy: `stop-${id}` });
    try {
      await invoke("docker_stop_container", { id });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  restartContainer: async (id) => {
    set({ actionBusy: `restart-${id}` });
    try {
      await invoke("docker_restart_container", { id });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  composeUp: async () => {
    const { workspaceRoot } = get();
    if (!workspaceRoot) return;
    set({ actionBusy: "compose-up" });
    try {
      await invoke("docker_compose_up", { req: { workspaceRoot } });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  composeUpBuild: async () => {
    const { workspaceRoot } = get();
    if (!workspaceRoot) return;
    set({ actionBusy: "compose-up-build" });
    try {
      await invoke("docker_compose_up_build", { req: { workspaceRoot } });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  composeDown: async () => {
    const { workspaceRoot } = get();
    if (!workspaceRoot) return;
    set({ actionBusy: "compose-down" });
    try {
      await invoke("docker_compose_down", { req: { workspaceRoot } });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  composeBuild: async () => {
    const { workspaceRoot } = get();
    if (!workspaceRoot) return;
    set({ actionBusy: "compose-build" });
    try {
      await invoke("docker_compose_build", { req: { workspaceRoot } });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  composeRestart: async () => {
    const { workspaceRoot } = get();
    if (!workspaceRoot) return;
    set({ actionBusy: "compose-restart" });
    try {
      await invoke("docker_compose_restart", { req: { workspaceRoot } });
      await get().loadContainers();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  openLogsTab: (container) => {
    const { runtime } = get();
    const binary = runtime?.available ? runtime.binary_path : "docker";
    useTerminalStore.getState().addSession({
      id: crypto.randomUUID(),
      name: `Logs: ${firstName(container)}`,
      type: "docker-logs",
      command: `${binary} logs -f --tail 100 ${container.id}`,
      isActive: true,
    });
  },

  openExecTab: (container, shell = "/bin/sh") => {
    const { runtime } = get();
    const binary = runtime?.available ? runtime.binary_path : "docker";
    useTerminalStore.getState().addSession({
      id: crypto.randomUUID(),
      name: `Exec: ${firstName(container)}`,
      type: "docker-exec",
      command: `${binary} exec -it ${container.id} ${shell}`,
      isActive: true,
    });
  },
}));
