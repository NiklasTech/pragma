import { isPathInside } from "@/features/ai/named-agents/folders";
import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

/** Whether a language server's project lies in, or around, one of the folders or worktrees given. */
export function ownsProjectRoot(projectRoot: string, roots: readonly string[]): boolean {
  // A server's root can sit above an opened subfolder, at the package.json of its monorepo.
  return roots.some((root) => isPathInside(root, projectRoot) || isPathInside(projectRoot, root));
}

/// Every server reports to every window; a window only speaks for its own folders and worktrees.
export function windowOwnsProjectRoot(projectRoot: string): boolean {
  const folders = useOpenRepositoriesStore.getState().spaces.flatMap((space) => space.folders);
  const worktrees = useAIStore.getState().workEnvironments.map((environment) => environment.path);
  return ownsProjectRoot(projectRoot, [...folders, ...worktrees]);
}
