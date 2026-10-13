import { invoke } from "@tauri-apps/api/core";

import { CLI_AGENT_FOLDERS, cliFolderPath } from "@/features/ai/cli-folders/sources";

import { cliAgentFileIdFromName, cliAgentId, parseCliAgent } from "./cliAgentFile";
import { projectAgentFileId, type ProjectAgentIssue, type ProjectAgentParse } from "./projectFile";
import type { ProjectAgents } from "./projectStorage";

interface DirEntry {
  path: string;
  name: string;
  is_file: boolean;
}

interface FileReadResult {
  content: string;
}

interface CliAgentSource {
  path: string;
  folderId: string;
  fileId: string;
  parse: (content: string) => ProjectAgentParse;
}

async function listAgentFiles(rootPath: string): Promise<CliAgentSource[]> {
  const perFolder = await Promise.all(
    CLI_AGENT_FOLDERS.map(async (folder) => {
      let entries: DirEntry[];
      try {
        entries = await invoke<DirEntry[]>("list_directory", {
          path: cliFolderPath(rootPath, folder),
        });
      } catch {
        return [];
      }
      return entries
        .filter((entry) => entry.is_file)
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((entry): CliAgentSource[] => {
          const fileId = cliAgentFileIdFromName(folder, entry.name);
          if (!fileId) return [];
          return [
            {
              path: entry.path,
              folderId: folder.id,
              fileId,
              parse: (content) => parseCliAgent(folder, fileId, entry.path, content),
            },
          ];
        });
    }),
  );
  return perFolder.flat();
}

/**
 * Adds the agents of coding CLI folders to the `.pragma` agents. A file id that `.pragma/agents`
 * or an earlier folder already uses is left out; a taken name is listed as an issue.
 */
export async function withCliAgents(
  rootPath: string,
  project: ProjectAgents,
): Promise<ProjectAgents> {
  const fileIds = new Set(
    [...project.agents, ...project.issues].map((item) => projectAgentFileId(item.id)),
  );
  const sources = (await listAgentFiles(rootPath)).filter((source) => {
    if (fileIds.has(source.fileId)) return false;
    fileIds.add(source.fileId);
    return true;
  });

  const parsed = await Promise.all(
    sources.map(async (source): Promise<ProjectAgentParse> => {
      try {
        const file = await invoke<FileReadResult>("read_text_file", { path: source.path });
        return source.parse(file.content);
      } catch {
        const issue: ProjectAgentIssue = {
          id: cliAgentId(source.folderId, source.fileId),
          path: source.path,
          name: source.fileId,
          error: "Could not read the file",
        };
        return { ok: false, issue };
      }
    }),
  );

  const agents = [...project.agents];
  const issues = [...project.issues];
  const names = new Set(agents.map((agent) => agent.name.toLowerCase()));
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
        path: sources[index].path,
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
