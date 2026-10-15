import { findRepository } from "@/shared/stores/openRepositories";

/// The repository a new session starts in: the picked one while it is open, otherwise the active one.
export function chooseRepository(
  paths: string[],
  activePath: string | null,
  picked: string | null = null,
): string | null {
  const open = picked ? findRepository(paths, picked) : null;
  return open ?? activePath;
}
