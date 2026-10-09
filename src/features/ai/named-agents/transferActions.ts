import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { useNamedAgentsStore } from "./store";
import { agentFileName, parseAgentFile, serializeAgent } from "./transfer";
import type { Agent } from "./types";

const FILTERS = [{ name: "Pragma agent", extensions: ["json"] }];

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

/// Asks for an agent file and adds it to the roster; returns the new agent.
export async function importAgent(): Promise<Agent | null> {
  try {
    const selected = await open({ multiple: false, filters: FILTERS });
    if (!selected || Array.isArray(selected)) return null;
    const file = await invoke<{ content: string }>("read_text_file", { path: selected });
    const { agents, saveAgent } = useNamedAgentsStore.getState();
    const parsed = parseAgentFile(file.content, agents);
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
