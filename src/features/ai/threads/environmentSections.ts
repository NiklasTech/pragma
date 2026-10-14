import type { WorkEnvironment } from "@/shared/stores/ai";

import type { ThreadSection } from "./categories";

/// One section per worktree (by branch), then the threads that work in the checkout.
export function buildEnvironmentSections<T extends { environmentId?: string }>(
  threads: T[],
  environments: readonly WorkEnvironment[],
): ThreadSection<T>[] {
  const worktrees = new Map(
    environments
      .filter((environment) => environment.kind === "worktree")
      .map((environment) => [environment.id, environment]),
  );
  const byWorktree = new Map<string, T[]>();
  const checkout: T[] = [];
  for (const thread of threads) {
    const worktree = thread.environmentId ? worktrees.get(thread.environmentId) : undefined;
    if (!worktree) {
      checkout.push(thread);
      continue;
    }
    const items = byWorktree.get(worktree.id) ?? [];
    items.push(thread);
    byWorktree.set(worktree.id, items);
  }

  const sections: ThreadSection<T>[] = [...byWorktree.entries()]
    .map(([id, items]) => ({
      key: `environment:${id}`,
      label: worktrees.get(id)?.branch ?? id,
      isCategory: true,
      items,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (checkout.length > 0) {
    sections.push({
      key: "environment:checkout",
      label: "This checkout",
      isCategory: true,
      items: checkout,
    });
  }
  return sections;
}
