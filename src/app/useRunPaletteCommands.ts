import { toast } from "sonner";
import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useRunConfigStore, type RunProcess } from "@/shared/stores/runConfig";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useLayoutStore } from "@/shell/layout";
import { useRegisterPaletteCommands } from "./useRegisterPaletteCommands";

async function startConfig(index: number): Promise<void> {
  const config = useRunConfigStore.getState().configs[index];
  if (!config) return;
  const processId = await useRunConfigStore.getState().startConfig(config);
  if (!processId) return;
  const layout = useLayoutStore.getState();
  if (layout.terminal.mode === "hidden") {
    layout.setTerminalMode("docked-bottom");
  }
  useTerminalStore
    .getState()
    .addRunSession(processId, config.name, config.command, resolveDefaultTerminalPanelId());
}

function pickConfig(): void {
  const { configs } = useRunConfigStore.getState();
  useCommandPaletteStore.getState().openPicker({
    placeholder: "Start run configuration...",
    emptyText: "No run configurations.",
    items: configs.map((config, index) => ({
      id: String(index),
      label: config.name,
      detail: config.command,
    })),
    onSelect: (item) => {
      void startConfig(Number(item.id)).catch((err: unknown) => toast.error(String(err)));
    },
  });
}

function pickProcess(
  placeholder: string,
  processes: RunProcess[],
  onSelect: (processId: string) => Promise<void>,
): void {
  useCommandPaletteStore.getState().openPicker({
    placeholder,
    emptyText: "No matching processes.",
    items: processes.map((process) => ({
      id: process.id,
      label: process.configName,
      detail: process.status,
    })),
    onSelect: (item) => void onSelect(item.id),
  });
}

const RUN_COMMANDS: CommandPaletteItem[] = [
  {
    id: "run.start",
    label: "Run: Start Configuration...",
    category: "Run",
    keywords: ["run", "start", "launch", "configuration"],
    action: pickConfig,
  },
  {
    id: "run.stop",
    label: "Run: Stop Configuration...",
    category: "Run",
    keywords: ["run", "stop", "kill", "configuration"],
    action: () => {
      const store = useRunConfigStore.getState();
      pickProcess(
        "Stop running process...",
        store.processes.filter((process) => process.status === "running"),
        store.stopProcess,
      );
    },
  },
  {
    id: "run.restart",
    label: "Run: Restart Configuration...",
    category: "Run",
    keywords: ["run", "restart", "reload", "configuration"],
    action: () => {
      const store = useRunConfigStore.getState();
      pickProcess("Restart process...", store.processes, store.restartProcess);
    },
  },
];

export function useRunPaletteCommands(): void {
  useRegisterPaletteCommands(RUN_COMMANDS);
}
