import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { parseAgentMarkdown } from "./markdownImport";
import { relativeAgentFolders, serializeProjectAgent } from "./projectFile";
import { useNamedAgentsStore } from "./store";
import { agentFileName, parseAgentFile, serializeAgent } from "./transfer";
import type { Agent, AgentEngine } from "./types";

const FILTERS = [{ name: "Pragma agent", extensions: ["json"] }];
const MARKDOWN_FILTERS = [{ name: "Markdown agent", extensions: ["md"] }];
const IMPORT_FILTERS = [{ name: "Agent", extensions: ["json", "md"] }];

/// The engine of a new agent: the built-in one with the current provider and model.
function currentEngine(): AgentEngine {
  const { activeProvider, activeModel, providers } = useAIStore.getState();
  const engine: AgentEngine = { kind: "builtin", provider: activeProvider, model: activeModel };
  const baseUrl = providers[activeProvider].baseUrl;
  if (baseUrl) engine.baseUrl = baseUrl;
  return engine;
}

export async function exportAgent(agent: Agent, includeMemory: boolean): Promise<void> {
  try {
    const path = await save({ defaultPath: agentFileName(agent), filters: FILTERS });
    if (!path) return;
    await invoke("write_text_file", { path, content: serializeAgent(agent, includeMemory) });
    toast.success(`Exported ${agent.name}`);
  } catch (err) {
    toast.error("Could not export the agent", { description: String(err) });
  }
}

/// Writes the agent in the `.pragma/agents` format; only folders inside the open workspace are kept.
export async function exportAgentMarkdown(agent: Agent): Promise<void> {
  try {
    const path = await save({
      defaultPath: agentFileName(agent).replace(/\.agent\.json$/, ".md"),
      filters: MARKDOWN_FILTERS,
    });
    if (!path) return;
    const rootPath = useFileExplorerStore.getState().rootPath;
    const folders = rootPath ? relativeAgentFolders(rootPath, agent.folders).relative : [];
    await invoke("write_text_file", { path, content: serializeProjectAgent(agent, folders) });
    toast.success(`Exported ${agent.name}`);
  } catch (err) {
    toast.error("Could not export the agent", { description: String(err) });
  }
}

/// Asks for an agent file and adds it to the roster; returns the new agent.
export async function importAgent(): Promise<Agent | null> {
  try {
    const selected = await open({ multiple: false, filters: IMPORT_FILTERS });
    if (!selected || Array.isArray(selected)) return null;
    const file = await invoke<{ content: string }>("read_text_file", { path: selected });
    const { personalAgents, saveAgent } = useNamedAgentsStore.getState();
    const fileName = selected.split(/[\\/]/).pop() ?? selected;
    const parsed = /\.md$/i.test(fileName)
      ? parseAgentMarkdown(file.content, fileName, personalAgents, currentEngine())
      : parseAgentFile(file.content, personalAgents);
    if (!parsed.ok) {
      toast.error("Could not import the agent", { description: parsed.error });
      return null;
    }
    await saveAgent(parsed.agent);
    toast.success(`Imported ${parsed.agent.name}`, {
      description:
        parsed.droppedFolders > 0
          ? "Folder access was not imported. Add folders when editing the agent."
          : undefined,
    });
    return parsed.agent;
  } catch (err) {
    toast.error("Could not import the agent", { description: String(err) });
    return null;
  }
}
