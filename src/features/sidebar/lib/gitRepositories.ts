import { getWorkspaceName } from "@/shared/lib/workspaceName";
import type { GitStatusSnapshot } from "@/shared/stores/git";
import type { RepositoryGitStatus } from "@/shared/stores/repositoryGit";

export interface GitRepositorySummary {
  path: string;
  name: string;
  branch: string | null;
  changes: number;
  active: boolean;
}

/// Open repositories whose status the git panel loads itself; the git store covers the active one.
export function inactiveRepositories(
  paths: readonly string[],
  activeRoot: string | null,
): string[] {
  return paths.filter((path) => path !== activeRoot);
}

/// One entry per open repository with its branch and number of changed files.
export function summarizeGitRepositories(
  paths: readonly string[],
  activeRoot: string | null,
  activeSnapshot: GitStatusSnapshot | null,
  byRoot: Readonly<Record<string, RepositoryGitStatus>>,
): GitRepositorySummary[] {
  return paths.map((path) => {
    const active = path === activeRoot;
    const snapshot = active ? activeSnapshot : (byRoot[path]?.snapshot ?? null);
    return {
      path,
      name: getWorkspaceName(path),
      branch: snapshot ? snapshot.repo.branch : null,
      changes: snapshot?.changed_files.length ?? 0,
      active,
    };
  });
}
