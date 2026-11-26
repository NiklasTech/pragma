import type { GoToFileEntry } from "@/shared/stores/goToFile";

export function toGoToFileEntry(rootPath: string, relativePath: string): GoToFileEntry {
  return {
    path: `${rootPath.replace(/[\\/]+$/, "")}/${relativePath}`,
    name: relativePath.slice(relativePath.lastIndexOf("/") + 1),
    relativePath,
  };
}
