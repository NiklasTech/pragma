"use client";

import { useState } from "react";
import {
  ArrowsInSimple,
  ArrowsOutSimple,
  Browser,
  ChatCircle,
  DotsThree,
  PencilSimple,
  Plus,
  Robot,
  Stop,
  X,
} from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ICON_SIZE, IconButton } from "@/shared/components/ui/icon-button";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { AGENT_STATE_LABELS, StatusDot } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession, type CLIManifest } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import type { AgentStatus } from "@/features/agent/store";

import { OpenInBrowserButton } from "../browser/OpenInBrowserButton";
import { CompactSessionMenuItem } from "../compaction/CompactSessionMenuItem";
import { ExportSessionMenu } from "../export/ExportSessionMenu";
import { ComposerMicButton } from "../components/ComposerMicButton";
import { isGeneratedTerminalTitle } from "../terminal/title";
import { useTerminalActivity } from "../terminal/useTerminalActivity";
import { useTerminalDictation } from "../terminal/useTerminalDictation";
import { useTerminalStatus } from "../terminal/useTerminalStatus";
import { SharersBadge } from "../sessions/SharersBadge";
import { SessionUsageBadge } from "../usage/SessionUsageBadge";
import { useNewSessionActions, type NewSessionActions } from "../threads/useNewSessionActions";
import { useSessionEnvironment } from "../worktree/useSessionEnvironment";
import { MAX_PANES_TITLE, type Leaf } from "./operations";
import { PaneRepositoryLabel } from "./PaneRepositoryLabel";
import { usePaneHeaderDrag } from "./paneDrag";
import { agentPaneState, terminalPaneLabel, terminalPaneState } from "./paneState";

// Details stay out of sight until the pane is focused, hovered or reached by keyboard.
const QUIET =
  "transition-opacity duration-(--motion-base) ease-(--motion-ease-out) group-hover/pane:opacity-100 group-focus-within/pane:opacity-100";

function PaneMark({
  leaf,
  session,
  manifest,
}: {
  leaf: Leaf;
  session: ChatSession | undefined;
  manifest: CLIManifest | undefined;
}) {
  const icon = "shrink-0 text-fg-muted";
  if (leaf.browser) return <Browser size={ICON_SIZE.sm} className={icon} aria-hidden="true" />;
  if (!session) return null;
  if (session.cliProviderId) {
    return <AgentMark agentId={session.cliProviderId} name={manifest?.name ?? "Terminal"} />;
  }
  if (session.kind === "ask") {
    return <ChatCircle size={ICON_SIZE.sm} className={icon} aria-hidden="true" />;
  }
  return <Robot size={ICON_SIZE.sm} className={icon} aria-hidden="true" />;
}

function paneTitle(
  leaf: Leaf,
  session: ChatSession | undefined,
  manifest: CLIManifest | undefined,
): string {
  if (leaf.browser) return "Browser";
  if (!session) return "Empty pane";
  if (session.kind === "terminal") {
    const name = manifest?.name ?? "Terminal";
    return isGeneratedTerminalTitle(session.title, name) ? name : session.title;
  }
  return session.title;
}

function startLike(
  session: ChatSession,
  manifest: CLIManifest | undefined,
  actions: NewSessionActions,
): void {
  if (session.kind === "terminal" && manifest) void actions.startTerminal(manifest);
  else if (session.agentEngine?.kind === "cli" && manifest)
    void actions.startConversation(manifest);
  else if (session.kind === "ask") void actions.startAsk();
  else void actions.startAgentCheckout();
}

function TerminalMic({ sessionId }: { sessionId: string }) {
  const { available, metered, dictation } = useTerminalDictation(sessionId);
  if (!available) return null;
  return (
    <ComposerMicButton
      recording={dictation.recording}
      disabled={dictation.busy}
      onClick={dictation.toggle}
      subscribeLevel={metered ? dictation.subscribeLevel : undefined}
    />
  );
}

interface PaneHeaderProps {
  leaf: Leaf;
  focused: boolean;
  status: AgentStatus;
  atCap: boolean;
  maximized: boolean;
  hasOtherPanes: boolean;
  onClose: () => void;
  onCloseTerminal: (stop: boolean) => void;
  onCloseOthers: () => void;
  onToggleMaximize: () => void;
  onDropOn: (targetLeafId: string) => void;
}

/** The pane's title line: state, agent and title; branch and actions show on focus or hover. */
export function PaneHeader({
  leaf,
  focused,
  status,
  atCap,
  maximized,
  hasOtherPanes,
  onClose,
  onCloseTerminal,
  onCloseOthers,
  onToggleMaximize,
  onDropOn,
}: PaneHeaderProps) {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const session = useAIStore((state) =>
    leaf.sessionId ? state.chatSessions.find((item) => item.id === leaf.sessionId) : undefined,
  );
  const manifest = useAIStore((state) =>
    session?.cliProviderId
      ? state.cliManifests.find((item) => item.id === session.cliProviderId)
      : undefined,
  );
  const renameChatSession = useAIStore((state) => state.renameChatSession);
  const actions = useNewSessionActions(rootPath);
  const drag = usePaneHeaderDrag(leaf.id, onDropOn);
  const [renaming, setRenaming] = useState(false);

  const terminal = session?.kind === "terminal" ? session : null;
  const terminalStatus = useTerminalStatus(terminal?.id ?? null);
  const terminalActive = useTerminalActivity(terminal?.id ?? null);
  const runningTerminal = terminal !== null && terminalStatus.status === "running";
  const terminalLook = { ...terminalStatus, active: terminalActive };
  const state = terminal ? terminalPaneState(terminalLook) : agentPaneState(status);
  const stateLabel = terminal ? terminalPaneLabel(terminalLook) : AGENT_STATE_LABELS[state];

  const environment = useSessionEnvironment(session);
  const worktree = environment?.kind === "worktree" ? environment : undefined;
  const branch = worktree?.branch ?? null;
  const title = paneTitle(leaf, session, manifest);
  const maximizeLabel = maximized ? "Restore" : "Zoom";
  const newLabel = terminal && manifest ? `New ${manifest.name}` : "New session";
  const canStartLike = session !== undefined && rootPath !== null;
  const shown = focused ? "opacity-100" : "opacity-0";

  return (
    <>
      <div
        className="@container/pane-header flex h-8.5 shrink-0 cursor-grab touch-none items-center gap-2 pr-1 pl-3 select-none active:cursor-grabbing"
        onDoubleClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
          if (target.closest("[data-pane-actions]")) return;
          onToggleMaximize();
        }}
        {...drag}
      >
        {!leaf.browser && session && (
          <span className="flex size-3 shrink-0 items-center justify-center" title={stateLabel}>
            <StatusDot state={state} className="size-1.75" />
          </span>
        )}
        <PaneMark leaf={leaf} session={session} manifest={manifest} />
        <span
          className={cn(
            "min-w-0 shrink truncate text-ui-sm font-medium transition-colors duration-(--motion-base)",
            focused ? "text-fg-default" : "text-fg-muted",
          )}
          title={title}
        >
          {title}
        </span>

        <span className={cn("flex min-w-0 shrink-[2] items-center gap-2", QUIET, shown)}>
          {branch && (
            <span
              className="flex min-w-0 items-center gap-1 font-mono text-ui-2xs text-fg-subtle @max-[360px]/pane-header:hidden"
              title={worktree ? `${branch} ${worktree.path}` : branch}
            >
              <span className="truncate">{branch}</span>
              <SharersBadge environmentId={worktree?.id} />
            </span>
          )}
          <PaneRepositoryLabel rootPath={session?.rootPath ?? rootPath} />
        </span>

        <span className="flex-1" />

        <div
          className={cn("flex shrink-0 items-center gap-0.5", QUIET, shown)}
          data-pane-actions=""
        >
          <SessionUsageBadge usage={session?.usage} className="@max-[300px]/pane-header:hidden" />
          {terminal && focused && <TerminalMic sessionId={terminal.id} />}
          {session && <OpenInBrowserButton session={session} />}
          <IconButton
            icon={maximized ? ArrowsInSimple : ArrowsOutSimple}
            label={maximizeLabel}
            size="sm"
            className="size-7 text-fg-subtle @max-[220px]/pane-header:hidden"
            onClick={onToggleMaximize}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Pane actions"
                  title="Pane actions"
                  className="text-fg-subtle"
                >
                  <DotsThree size={ICON_SIZE.md} weight="bold" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-[190px]">
              {session && (
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <PencilSimple size={ICON_SIZE.sm} />
                  <span>Rename</span>
                </DropdownMenuItem>
              )}
              {session && <CompactSessionMenuItem session={session} />}
              {session && <ExportSessionMenu session={session} />}
              {canStartLike && (
                <DropdownMenuItem
                  disabled={atCap}
                  title={atCap ? MAX_PANES_TITLE : undefined}
                  onClick={() => startLike(session, manifest, actions)}
                >
                  <Plus size={ICON_SIZE.sm} />
                  <span>{newLabel}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onToggleMaximize}>
                {maximized ? (
                  <ArrowsInSimple size={ICON_SIZE.sm} />
                ) : (
                  <ArrowsOutSimple size={ICON_SIZE.sm} />
                )}
                <span>{maximizeLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!hasOtherPanes} onClick={onCloseOthers}>
                <span>Close other panes</span>
              </DropdownMenuItem>
              {runningTerminal ? (
                <>
                  <DropdownMenuItem variant="destructive" onClick={() => onCloseTerminal(true)}>
                    <Stop size={ICON_SIZE.sm} />
                    <span>Stop process and close</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCloseTerminal(false)}>
                    <X size={ICON_SIZE.sm} />
                    <span>Close, keep running</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={onClose}>
                  <X size={ICON_SIZE.sm} />
                  <span>Close pane</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {session && (
        <InputDialog
          open={renaming}
          onOpenChange={setRenaming}
          title="Rename session"
          label="Name"
          defaultValue={terminal && title === manifest?.name ? "" : session.title}
          confirmLabel="Rename"
          onConfirm={(value) => void renameChatSession(session.id, value)}
        />
      )}
    </>
  );
}
