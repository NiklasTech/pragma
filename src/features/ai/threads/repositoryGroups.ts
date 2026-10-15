import { getWorkspaceName } from "@/shared/lib/workspaceName";

import type { ThreadSection } from "./categories";

export interface RepositoryGroup<T> {
  key: string;
  path: string;
  name: string;
  count: number;
  sections: ThreadSection<T>[];
}

/// One group per open repository with threads, in the order the repositories were opened.
export function groupByRepository<T extends { rootPath: string }>(
  paths: readonly string[],
  threads: readonly T[],
  buildSections: (threads: T[], path: string) => ThreadSection<T>[],
): RepositoryGroup<T>[] {
  const byPath = new Map<string, T[]>();
  for (const thread of threads) {
    const items = byPath.get(thread.rootPath) ?? [];
    items.push(thread);
    byPath.set(thread.rootPath, items);
  }

  return paths.flatMap((path) => {
    const items = byPath.get(path);
    if (!items) return [];
    const sections = buildSections(items, path).map((section) => ({
      ...section,
      key: `${path}\n${section.key}`,
    }));
    return [
      {
        key: `repository:${path}`,
        path,
        name: getWorkspaceName(path),
        count: items.length,
        sections,
      },
    ];
  });
}
