import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

import { getIsMac } from "@/shared/lib/shortcuts";
import { useRunConfigStore } from "@/shared/stores/runConfig";
import { processLabel } from "@/shared/stores/runProcesses";

/// Keeps Run > Run Task and Run > Stop Task of the macOS menu in step with the run configurations.
export function useNativeRunMenu(): void {
  const configs = useRunConfigStore((state) => state.configs);
  const processes = useRunConfigStore((state) => state.processes);
  const workspaceRoot = useRunConfigStore((state) => state.workspaceRoot);

  useEffect(() => {
    if (!getIsMac()) return;
    const start = configs.map((config) => ({ id: config.name, label: config.name }));
    const stop = processes
      .filter((process) => process.status === "running")
      .map((process) => ({ id: process.id, label: processLabel(process, workspaceRoot) }));
    void invoke("macos_menu_set_run_tasks", { start, stop });
  }, [configs, processes, workspaceRoot]);
}
