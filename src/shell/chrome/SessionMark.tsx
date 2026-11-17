import { sessionAgentManifest } from "@/features/ai/sessions/sessionAgent";
import { isShellSession, SHELL_TITLE } from "@/features/ai/terminal/shell";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import type { AgentState } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession, type CLIManifest } from "@/shared/stores/ai";

import { useShellClisStore } from "./shellClis";

export interface SessionIdentity {
  session: ChatSession | undefined;
  manifest: CLIManifest | undefined;
  /** A plain shell with no coding CLI running in it. */
  shell: boolean;
  /** The agent's name: its CLI, "Shell" or Pragma's own agent. */
  name: string;
  /** The session title; a shell named after the CLI running in it, like its pane. */
  title: string;
}

export function useSessionIdentity(sessionId: string): SessionIdentity {
  const session = useAIStore((state) => state.chatSessions.find((item) => item.id === sessionId));
  const isShell = session !== undefined && isShellSession(session);
  const foregroundId = useShellClisStore((state) => state.bySession[sessionId]);
  const foreground = useAIStore((state) =>
    isShell && foregroundId
      ? state.cliManifests.find((item) => item.id === foregroundId)
      : undefined,
  );
  const ownManifest = useAIStore((state) => sessionAgentManifest(state, sessionId));
  const manifest = isShell ? foreground : ownManifest;
  const shell = isShell && !manifest;
  const name = manifest?.name ?? (shell ? "Shell" : "Pragma");
  const rawTitle = session?.title ?? "";
  const title = isShell && rawTitle === SHELL_TITLE ? name : rawTitle;
  return { session, manifest, shell, name, title };
}

// Square state cells as in the D mockup: orange glow, blue, green, a faint outline.
export const STATE_CELL_CLASSES: Record<AgentState, string> = {
  "needs-you": "bg-state-needs-you shadow-[0_0_6px_var(--color-accent-glow)]",
  working: "bg-status-info",
  done: "bg-state-done",
  idle: "bg-fg-default/20",
};

// The cell's ring takes the color of the surface behind the mark.
const CELL_RING = {
  chrome: "ring-bg-chrome",
  sheet: "ring-bg-sheet",
} as const;

interface SessionMarkProps {
  identity: SessionIdentity;
  state?: AgentState;
  surface: keyof typeof CELL_RING;
}

/// The agent's letter in its color, or "$" for a shell, with the state as a square in the corner.
export function SessionMark({ identity, state, surface }: SessionMarkProps) {
  return (
    <span aria-hidden="true" className="relative inline-flex shrink-0">
      {identity.shell ? (
        <span className="inline-flex size-5 items-center justify-center rounded-[4px] font-mono text-[10.5px] font-bold text-fg-muted ring-1 ring-fg-default/15 ring-inset">
          $
        </span>
      ) : (
        <AgentMark
          agentId={identity.manifest?.id}
          name={identity.name}
          className="size-5 rounded-[4px] font-mono text-[10.5px]"
        />
      )}
      {state && (
        <span
          className={cn(
            "absolute -right-[3px] -bottom-[3px] size-1.5 rounded-[1.5px] ring-2",
            STATE_CELL_CLASSES[state],
            CELL_RING[surface],
          )}
        />
      )}
    </span>
  );
}
