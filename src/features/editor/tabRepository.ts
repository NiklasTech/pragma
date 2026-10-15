import { owningRepository } from "@/shared/stores/openRepositories";

/// The open repository a tab's file belongs to when that is not the active one, else null.
export function otherTabRepository(
  path: string,
  repositories: readonly string[],
  activeRoot: string | null,
): string | null {
  const owner = owningRepository(repositories, path);
  return owner && owner !== activeRoot ? owner : null;
}
