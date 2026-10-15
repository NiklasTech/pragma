import { owningRepository } from "@/shared/stores/openRepositories";
import type { TerminalSession } from "@/shared/stores/terminal";

/// Repositories a new terminal can start in, the active one first.
export function terminalRepositoryChoices(
  paths: readonly string[],
  activeRoot: string | null,
): string[] {
  const active = activeRoot && paths.includes(activeRoot) ? [activeRoot] : [];
  return [...active, ...paths.filter((path) => path !== activeRoot)];
}

/// The open repository a terminal started in, taken from its working directory.
export function terminalRepository(
  session: Pick<TerminalSession, "cwd">,
  paths: readonly string[],
): string | null {
  return session.cwd ? owningRepository(paths, session.cwd) : null;
}

/// The repository whose terminal environment a session gets: its own, else the active one.
export function terminalEnvRoot(
  session: Pick<TerminalSession, "cwd">,
  paths: readonly string[],
  activeRoot: string | null,
): string | null {
  return terminalRepository(session, paths) ?? activeRoot;
}
