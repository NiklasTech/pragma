import type { VisibleFileNode } from "@/shared/stores/fileExplorer";

/** At most this many files show while filtering; typing more narrows them down. */
export const FILTER_LIMIT = 300;

interface Folder {
  folders: Map<string, Folder>;
  files: string[];
}

/// Files of the folder whose relative path contains the query, as a tree with every folder open.
export function filterWorkspaceFiles(
  root: string,
  files: readonly string[],
  query: string,
): VisibleFileNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const top: Folder = { folders: new Map(), files: [] };
  let count = 0;
  for (const file of files) {
    if (!file.toLowerCase().includes(needle)) continue;
    const parts = file.split("/");
    let folder = top;
    for (const part of parts.slice(0, -1)) {
      let next = folder.folders.get(part);
      if (!next) {
        next = { folders: new Map(), files: [] };
        folder.folders.set(part, next);
      }
      folder = next;
    }
    folder.files.push(parts[parts.length - 1]);
    count += 1;
    if (count >= FILTER_LIMIT) break;
  }

  const result: VisibleFileNode[] = [];
  const walk = (folder: Folder, prefix: string, depth: number) => {
    for (const name of [...folder.folders.keys()].sort()) {
      const path = `${prefix}/${name}`;
      result.push({ node: { path, name, isDirectory: true, isFile: false }, depth });
      walk(folder.folders.get(name) as Folder, path, depth + 1);
    }
    for (const name of folder.files.sort()) {
      result.push({
        node: { path: `${prefix}/${name}`, name, isDirectory: false, isFile: true },
        depth,
      });
    }
  };
  walk(top, root, 0);
  return result;
}
