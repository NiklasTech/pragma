import { invoke } from "@tauri-apps/api/core";

import {
  agentsDir,
  parseProjectAgent,
  projectAgentFileId,
  projectAgentId,
  projectAgentPath,
  relativeAgentFolders,
  serializeProjectAgent,
  type ProjectAgentIssue,
  type ProjectAgentParse,
} from "./projectFile";
import type { Agent, AgentMemoryEntry } from "./types";

interface DirEntry {
  path: string;
  name: string;
  is_file: boolean;
}

interface FileReadResult {
  content: string;
}

export type ProjectMemory = Record<string, AgentMemoryEntry[]>;

export interface ProjectAgents {
  agents: Agent[];
  issues: ProjectAgentIssue[];
}

export async function loadProjectAgents(rootPath: string): Promise<ProjectAgents> {
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>("list_directory", { path: agentsDir(rootPath) });
  } catch {
    return { agents: [], issues: [] };
  }

  const files = entries
    .filter((entry) => entry.is_file && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parsed = await Promise.all(
    files.map(async (entry): Promise<ProjectAgentParse> => {
      const fileId = entry.name.slice(0, -".md".length);
      try {
        const file = await invoke<FileReadResult>("read_text_file", { path: entry.path });
        return parseProjectAgent(fileId, entry.path, file.content, rootPath);
      } catch {
        const issue = { id: projectAgentId(fileId), path: entry.path, name: fileId };
        return { ok: false, issue: { ...issue, error: "Could not read the file" } };
      }
    }),
  );

  const agents: Agent[] = [];
  const issues: ProjectAgentIssue[] = [];
  const names = new Set<string>();
  parsed.forEach((result, index) => {
    if (!result.ok) {
      issues.push(result.issue);
      return;
    }
    const key = result.agent.name.toLowerCase();
    if (names.has(key)) {
      const { id, name } = result.agent;
      issues.push({
        id,
        name,
        path: files[index].path,
        error: "Another project agent has this name",
      });
      return;
    }
    names.add(key);
    agents.push(result.agent);
  });
  return {
    agents: agents.sort((a, b) => a.name.localeCompare(b.name)),
    issues: issues.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Writes the agent to `.pragma/agents/<fileId>.md`; folders outside the workspace are refused. */
export async function writeProjectAgent(rootPath: string, agent: Agent): Promise<void> {
  const fileId = projectAgentFileId(agent.id);
  if (!fileId) throw new Error("Not a project agent");
  const { relative, outside } = relativeAgentFolders(rootPath, agent.folders);
  if (outside.length > 0) {
    throw new Error("Project agents can only use folders inside the workspace");
  }

  const dir = agentsDir(rootPath);
  try {
    await invoke("create_directory", { path: dir });
  } catch {
    // The folder already exists; a real failure surfaces on the write below.
  }
  await invoke("write_text_file", {
    path: projectAgentPath(rootPath, fileId),
    content: serializeProjectAgent(agent, relative),
  });
}

export async function deleteProjectAgentFile(rootPath: string, agentId: string): Promise<void> {
  const fileId = projectAgentFileId(agentId);
  if (!fileId) throw new Error("Not a project agent");
  await invoke("delete_file", { path: projectAgentPath(rootPath, fileId) });
}

export async function loadProjectMemory(rootPath: string): Promise<ProjectMemory> {
  return invoke<ProjectMemory>("agents_project_memory_load", { req: { root_path: rootPath } });
}

export async function saveProjectMemory(rootPath: string, memory: ProjectMemory): Promise<void> {
  await invoke("agents_project_memory_save", { req: { root_path: rootPath, memory } });
}
