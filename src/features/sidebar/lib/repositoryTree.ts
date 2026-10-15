import { getWorkspaceName } from "@/shared/lib/workspaceName";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";

/// Whether the tree already holds one top-level folder per open repository, in order.
export function isRepositoryTree(
  tree: readonly FileSystemNode[],
  paths: readonly string[],
): boolean {
  return (
    tree.length === paths.length &&
    tree.every((node, index) => node.repositoryRoot === true && node.path === paths[index])
  );
}

/// One top-level folder per open repository; loaded folders stay, and a single-root tree becomes the active repository's contents.
export function repositoryNodes(
  paths: readonly string[],
  tree: readonly FileSystemNode[],
  activeRoot: string | null,
): FileSystemNode[] {
  const known = new Map(
    tree.filter((node) => node.repositoryRoot).map((node) => [node.path, node]),
  );
  const singleRoot = tree.length > 0 && !tree.some((node) => node.repositoryRoot);
  return paths.map((path) => {
    const prior = known.get(path);
    if (prior) return prior;
    return {
      path,
      name: getWorkspaceName(path),
      isDirectory: true,
      isFile: false,
      children: singleRoot && path === activeRoot ? [...tree] : [],
      repositoryRoot: true,
    };
  });
}
