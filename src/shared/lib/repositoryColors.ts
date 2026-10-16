import { normalizePath } from "@/features/ai/named-agents/folders";

export const REPOSITORY_PALETTE = [
  "#2f9bff",
  "#f472b6",
  "#4ade80",
  "#fb923c",
  "#a78bfa",
  "#facc15",
  "#2dd4bf",
  "#f87171",
];

export interface RepositoryColorEntry {
  color: string;
  /** Picked by the user; automatic colors only show once several repositories are open. */
  chosen: boolean;
}

export type RepositoryColorMap = Record<string, RepositoryColorEntry>;

export interface RepositoryColorSettings {
  /** Normalized repository path -> color. */
  byPath: RepositoryColorMap;
  /** The active repository's color replaces the accent color. */
  useAsAccent: boolean;
}

export const REPOSITORY_COLOR_DEFAULTS: RepositoryColorSettings = {
  byPath: {},
  useAsAccent: false,
};

export function repositoryColorKey(path: string): string {
  return normalizePath(path);
}

export function repositoryColorEntry(
  byPath: RepositoryColorMap,
  path: string,
): RepositoryColorEntry | null {
  return byPath[repositoryColorKey(path)] ?? null;
}

/**
 * Gives every open repository without a color the next palette color no other open repository
 * uses, in the order they were opened. Null when every repository already has one.
 */
export function assignRepositoryColors(
  paths: readonly string[],
  byPath: RepositoryColorMap,
): RepositoryColorMap | null {
  const used = new Set(
    paths.flatMap((path) => {
      const entry = repositoryColorEntry(byPath, path);
      return entry ? [entry.color] : [];
    }),
  );
  let next: RepositoryColorMap | null = null;
  for (const path of paths) {
    if (repositoryColorEntry(next ?? byPath, path)) continue;
    const color =
      REPOSITORY_PALETTE.find((candidate) => !used.has(candidate)) ??
      REPOSITORY_PALETTE[used.size % REPOSITORY_PALETTE.length];
    used.add(color);
    next = { ...(next ?? byPath), [repositoryColorKey(path)]: { color, chosen: false } };
  }
  return next;
}

/** The color to show for a repository, or null while it would only add noise. */
export function visibleRepositoryColor(
  byPath: RepositoryColorMap,
  path: string,
  openCount: number,
): string | null {
  const entry = repositoryColorEntry(byPath, path);
  if (!entry) return null;
  return openCount > 1 || entry.chosen ? entry.color : null;
}

/** The accent the active repository asks for; empty when the option is off or nothing is active. */
export function repositoryAccent(
  settings: RepositoryColorSettings,
  activePath: string | null,
): string {
  if (!settings.useAsAccent || !activePath) return "";
  return repositoryColorEntry(settings.byPath, activePath)?.color ?? "";
}

export function withRepositoryColor(
  byPath: RepositoryColorMap,
  path: string,
  color: string | null,
): RepositoryColorMap {
  const next = { ...byPath };
  const key = repositoryColorKey(path);
  if (color) next[key] = { color, chosen: true };
  else delete next[key];
  return next;
}
