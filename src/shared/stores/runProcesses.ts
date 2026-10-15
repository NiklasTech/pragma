import { getWorkspaceName } from "@/shared/lib/workspaceName";

import type { RunProcess } from "./runConfig";

export function repositoryProcesses<T extends Pick<RunProcess, "rootPath">>(
  processes: readonly T[],
  rootPath: string,
): T[] {
  return processes.filter((process) => process.rootPath === rootPath);
}

/// Running processes started in repositories other than the active one.
export function otherRepositoryProcesses<T extends Pick<RunProcess, "rootPath" | "status">>(
  processes: readonly T[],
  rootPath: string,
): T[] {
  return processes.filter(
    (process) => process.rootPath !== rootPath && process.status === "running",
  );
}

/// The config name, followed by the repository for a process outside the active one.
export function processLabel(
  process: Pick<RunProcess, "rootPath" | "configName">,
  activeRoot: string,
): string {
  if (process.rootPath === activeRoot) return process.configName;
  return `${process.configName} (${getWorkspaceName(process.rootPath)})`;
}
