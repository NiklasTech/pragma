import { isPathInside } from "@/features/ai/named-agents/folders";

/// The open repository a tab's file belongs to when that is not the active one, else null.
export function otherTabRepository(
  path: string,
  repositories: readonly string[],
  activeRoot: string | null,
): string | null {
  const owner = repositories
    .filter((root) => isPathInside(root, path))
    .reduce<string | null>(
      (best, root) => (!best || root.length > best.length ? root : best),
      null,
    );
  return owner && owner !== activeRoot ? owner : null;
}
