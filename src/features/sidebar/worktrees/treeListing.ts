import type { FileSystemNode } from "@/shared/stores/fileExplorer";

import { mergeChildren } from "../lib/fileTreeRefresh";

/// The tree with a fresh listing of one folder; the root itself when `dir` is the root, and loaded subtrees stay.
export function withListing(
  tree: readonly FileSystemNode[],
  root: string,
  dir: string,
  listing: FileSystemNode[],
): FileSystemNode[] {
  if (dir === root) return mergeChildren([...tree], listing);
  const update = (nodes: readonly FileSystemNode[]): FileSystemNode[] =>
    nodes.map((node) => {
      if (node.path === dir) {
        return { ...node, children: mergeChildren(node.children ?? [], listing), error: undefined };
      }
      return node.children ? { ...node, children: update(node.children) } : node;
    });
  return update(tree);
}
