import { groupThreadsByRecency } from "./helpers";

export const MAX_CATEGORY_LENGTH = 40;

export interface ThreadSection<T> {
  key: string;
  label: string;
  isCategory: boolean;
  items: T[];
}

export function normalizeCategory(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, MAX_CATEGORY_LENGTH).trim();
  return trimmed || null;
}

export function listCategories(threads: { category?: string }[]): string[] {
  const names = new Set<string>();
  for (const thread of threads) if (thread.category) names.add(thread.category);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/// Categories first (alphabetical), then the uncategorized threads bucketed by recency.
export function buildThreadSections<T extends { category?: string; updatedAt: number }>(
  threads: T[],
  isActive: (thread: T) => boolean,
  now: number = Date.now(),
): ThreadSection<T>[] {
  const byCategory = new Map<string, T[]>();
  const uncategorized: T[] = [];
  for (const thread of threads) {
    if (!thread.category) {
      uncategorized.push(thread);
      continue;
    }
    const items = byCategory.get(thread.category) ?? [];
    items.push(thread);
    byCategory.set(thread.category, items);
  }

  const categories = [...byCategory.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((label) => ({
      key: `category:${label}`,
      label,
      isCategory: true,
      items: byCategory.get(label) ?? [],
    }));
  const recency = groupThreadsByRecency(uncategorized, isActive, now).map((group) => ({
    key: `recent:${group.label}`,
    label: group.label,
    isCategory: false,
    items: group.items,
  }));

  return [...categories, ...recency];
}
