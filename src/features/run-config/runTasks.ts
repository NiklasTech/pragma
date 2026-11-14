import { repositoryProcesses } from "@/shared/stores/runProcesses";
import { useRunConfigStore, type RunConfig } from "@/shared/stores/runConfig";
import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useLayoutStore } from "@/shell/layout/store";

function showTerminal(): void {
  const layout = useLayoutStore.getState();
  if (layout.terminal.mode === "hidden") layout.setTerminalMode("docked-bottom");
}

/** Starts a run configuration and shows its output in a terminal tab. */
export async function startRunConfig(config: RunConfig): Promise<void> {
  const processId = await useRunConfigStore.getState().startConfig(config);
  if (!processId) return;
  showTerminal();
  useTerminalStore
    .getState()
    .addRunSession(processId, config.name, config.command, resolveDefaultTerminalPanelId());
}

/** Runs the configuration with this name: restarts its stopped process of this folder, else starts it. */
export async function runTaskByName(name: string): Promise<void> {
  const { configs, processes, workspaceRoot, restartProcess } = useRunConfigStore.getState();
  const config = configs.find((candidate) => candidate.name === name);
  if (!config) return;
  const own = repositoryProcesses(processes, workspaceRoot).find(
    (process) => process.configName === name,
  );
  if (own?.status === "running") return;
  if (own) {
    await restartProcess(own.id);
    return;
  }
  await startRunConfig(config);
}
