import { toast } from "sonner";
import { useEditorStore } from "@/shared/stores/editor";
import { useRunConfigStore } from "@/shared/stores/runConfig";
import { detectLanguage } from "@/shared/lib/language";
import { useDebugStore } from "./store";

export interface DebugFileTarget {
  adapter: string;
  runtime: string;
}

export function debugTargetForLanguage(language: string | undefined): DebugFileTarget | null {
  switch (language) {
    case "python":
      return { adapter: "python", runtime: "python" };
    case "javascript":
    case "typescript":
      return { adapter: "node", runtime: "node" };
    case "rust":
      return { adapter: "lldb", runtime: "" };
    default:
      return null;
  }
}

export async function debugCurrentFile(): Promise<void> {
  const { tabs, activeTabId } = useEditorStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab || tab.kind !== "file") {
    toast.error("No active file to debug");
    return;
  }

  const language = tab.language ?? detectLanguage(tab.name);
  const target = debugTargetForLanguage(language);
  if (!target) {
    toast.error(`No debug adapter for ${language ?? tab.name}`);
    return;
  }

  if (language === "rust") {
    toast.info(
      "Rust requires a compiled binary — use a run config with debug adapter 'lldb' and the binary as command (e.g. target/debug/myapp.exe)",
    );
    return;
  }

  const workspaceRoot = useRunConfigStore.getState().workspaceRoot;
  if (!workspaceRoot) {
    toast.error("No workspace folder open");
    return;
  }

  await useDebugStore.getState().startSession({
    name: tab.name,
    command: `${target.runtime} "${tab.path}"`,
    env: {},
    autostart: false,
    autoRestart: false,
    debug: { adapter: target.adapter, request: "launch" },
  });
}
