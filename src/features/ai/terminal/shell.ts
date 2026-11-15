import type { ChatSession } from "@/shared/stores/ai";

import { startSession } from "../sessions/start";

/** The provider id of a plain shell pane; no CLI manifest carries it. */
export const SHELL_PROVIDER_ID = "shell";

export const SHELL_TITLE = "Shell";

export function isShellSession(session: Pick<ChatSession, "kind" | "cliProviderId">): boolean {
  return session.kind === "terminal" && session.cliProviderId === SHELL_PROVIDER_ID;
}

/** A shell in the folder itself; a coding CLI started in it is recognized by the pane. */
export function createShellSession(
  rootPath: string,
  options?: { activate?: boolean },
): Promise<ChatSession> {
  return startSession(rootPath, {
    init: { kind: "terminal", cliProviderId: SHELL_PROVIDER_ID, title: SHELL_TITLE },
    environment: "checkout",
    activate: options?.activate,
  });
}
