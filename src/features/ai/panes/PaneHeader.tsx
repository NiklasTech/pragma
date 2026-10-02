"use client";

import { useState } from "react";
import {
  ArrowsInSimple,
  ArrowsOutSimple,
  Browser,
  ChatCircle,
  DotsThree,
  GitBranch,
  PencilSimple,
  Plus,
  Robot,
  X,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession, type CLIManifest } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import type { AgentStatus } from "@/features/agent/store";

import { OpenInBrowserButton } from "../browser/OpenInBrowserButton";
import { ComposerMicButton } from "../components/ComposerMicButton";
import { isGeneratedTerminalTitle } from "../terminal/title";
import { useTerminalDictation } from "../terminal/useTerminalDictation";
import { useTerminalStatus } from "../terminal/useTerminalStatus";
import { useNewSessionActions, type NewSessionActions } from "../threads/useNewSessionActions";
import { MAX_PANES_TITLE, type Leaf } from "./operations";
import { usePaneHeaderDrag } from "./paneDrag";
import { ProviderLogo } from "./ProviderLogo";

const PANE_ICON_BUTTON =
  "flex size-6 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors enabled:hover:bg-bg-hover enabled:hover:text-fg-default disabled:opacity-40";

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running",
  "waiting-approval": "Waiting",
  done: "Done",
  error: "Error",
  cancelled: "Cancelled",
};

const STATUS_DOTS: Record<AgentStatus, string> = {
  idle: "bg-fg-subtle",
  running: "bg-linear-to-r from-brand-from to-brand-to animate-pulse",
  "waiting-approval": "bg-status-warning",
  done: "bg-status-success",
  error: "bg-status-error",
  cancelled: "bg-fg-subtle",
};

interface PaneIdentity {
  title: string;
  icon: React.ReactNode;
  showTitle: boolean;
}

function identify(
  leaf: Leaf,
  session: ChatSession | undefined,
  manifest: CLIManifest | undefined,
): PaneIdentity {
  if (leaf.browser) {
    return { title: "Browser", icon: <Browser size={14} className="shrink-0" />, showTitle: true };
  }
  if (!session) return { title: "Empty pane", icon: null, showTitle: true };

  const logo = session.cliProviderId ? (
    <ProviderLogo
      providerId={session.cliProviderId}
      name={manifest?.name ?? "Terminal"}
      size={14}
      className="text-fg-muted"
    />
  ) : null;

  if (session.kind === "terminal") {
    const name = manifest?.name ?? "Terminal";
    const named = !isGeneratedTerminalTitle(session.title, name);
    return { title: named ? session.title : name, icon: logo, showTitle: named };
  }

  const icon =
    logo ??
    (session.kind === "ask" ? (
      <ChatCircle size={14} className="shrink-0 text-fg-muted" />
    ) : (
      <Robot size={14} className="shrink-0 text-fg-muted" />
    ));
  return { title: session.title, icon, showTitle: true };
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

function TerminalStatusDot({ sessionId }: { sessionId: string }) {
  const { status, exitCode } = useTerminalStatus(sessionId);
  const label =
    status === "running"
      ? "Running"
      : status === "cancelled"
        ? "Cancelled"
        : exitCode !== null
          ? `Exited (${exitCode})`
          : "Exited";
  const dot =
    status === "running"
      ? "bg-status-success"
      : exitCode !== null && exitCode !== 0
        ? "bg-status-error"
        : "bg-fg-subtle";

  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", dot)}
      title={label}
      role="img"
      aria-label={label}
      data-terminal-status={status}
    />
  );
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
  onCloseOthers: () => void;
  onToggleMaximize: () => void;
  onDropOn: (targetLeafId: string) => void;
}

export function PaneHeader({
  leaf,
  focused,
  status,
  atCap,
  maximized,
  hasOtherPanes,
  onClose,
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

  const identity = identify(leaf, session, manifest);
  const terminal = session?.kind === "terminal" ? session : null;
  const branch = session?.worktree?.branch ?? null;
  const maximizeLabel = maximized ? "Restore" : "Maximize";
  const newLabel = terminal && manifest ? `New ${manifest.name}` : "New session";
  const canStartLike = session !== undefined && rootPath !== null;

  return (
    <>
      <div
        className="@container/pane-header flex h-8 shrink-0 cursor-grab touch-none items-center gap-1.5 border-b border-border-subtle pr-1 pl-2.5 select-none active:cursor-grabbing"
        onDoubleClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
          if (target.closest("[data-pane-actions]")) return;
          onToggleMaximize();
        }}
        {...drag}
      >
        {terminal ? (
          <TerminalStatusDot sessionId={terminal.id} />
        ) : (
          <span
            className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOTS[status])}
            title={STATUS_LABELS[status]}
            role="img"
            aria-label={STATUS_LABELS[status]}
          />
        )}
        <span
          className="flex min-w-0 items-center gap-1.5"
          title={identity.title}
          aria-label={identity.showTitle ? undefined : identity.title}
        >
          {identity.icon}
          {identity.showTitle && (
            <span className="truncate text-ui-xs font-semibold text-fg-default">
              {identity.title}
            </span>
          )}
        </span>
        {branch && (
          <span
            className="flex min-w-0 shrink items-center gap-1 text-ui-2xs text-fg-subtle @max-[360px]/pane-header:hidden"
            title={session?.worktree ? `${branch} ${session.worktree.path}` : branch}
          >
            <GitBranch size={11} className="shrink-0" />
            <span className="truncate">{branch}</span>
          </span>
        )}

        <span className="flex-1" />

        <div className="flex shrink-0 items-center gap-0.5" data-pane-actions="">
          {terminal && focused && <TerminalMic sessionId={terminal.id} />}
          {session && <OpenInBrowserButton session={session} className={PANE_ICON_BUTTON} />}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Pane actions"
                  title="Pane actions"
                  className={PANE_ICON_BUTTON}
                >
                  <DotsThree size={14} weight="bold" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {session && (
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <PencilSimple size={13} />
                  <span>Rename</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onToggleMaximize}>
                {maximized ? <ArrowsInSimple size={13} /> : <ArrowsOutSimple size={13} />}
                <span>{maximizeLabel}</span>
              </DropdownMenuItem>
              {canStartLike && (
                <DropdownMenuItem
                  disabled={atCap}
                  title={atCap ? MAX_PANES_TITLE : undefined}
                  onClick={() => startLike(session, manifest, actions)}
                >
                  <Plus size={13} />
                  <span>{newLabel}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!hasOtherPanes} onClick={onCloseOthers}>
                <span>Close other panes</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClose}>
                <X size={13} />
                <span>Close pane</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={onToggleMaximize}
            aria-label={maximizeLabel}
            title={maximizeLabel}
            className={cn(PANE_ICON_BUTTON, "@max-[240px]/pane-header:hidden")}
          >
            {maximized ? <ArrowsInSimple size={13} /> : <ArrowsOutSimple size={13} />}
          </button>
          {canStartLike && (
            <button
              type="button"
              onClick={() => startLike(session, manifest, actions)}
              disabled={atCap}
              aria-label={newLabel}
              title={atCap ? MAX_PANES_TITLE : newLabel}
              className={cn(PANE_ICON_BUTTON, "@max-[240px]/pane-header:hidden")}
            >
              <Plus size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pane"
            title="Close pane"
            className={PANE_ICON_BUTTON}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {session && rootPath && (
        <InputDialog
          open={renaming}
          onOpenChange={setRenaming}
          title="Rename session"
          label="Name"
          defaultValue={identity.showTitle ? session.title : ""}
          confirmLabel="Rename"
          onConfirm={(value) => void renameChatSession(rootPath, session.id, value)}
        />
      )}
    </>
  );
}
