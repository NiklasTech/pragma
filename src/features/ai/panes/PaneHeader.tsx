"use client";

import { useCallback } from "react";
import {
  ArrowsInSimple,
  ArrowsOutSimple,
  ChatCircle,
  Columns,
  DotsThree,
  GitBranch,
  Robot,
  Rows,
  X,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession, type CLIManifest } from "@/shared/stores/ai";
import { useAgentStore, type AgentStatus } from "@/features/agent/store";

import { OpenInBrowserButton } from "../browser/OpenInBrowserButton";
import { ComposerMicButton } from "../components/ComposerMicButton";
import { isGeneratedTerminalTitle } from "../terminal/title";
import { useTerminalDictation } from "../terminal/useTerminalDictation";
import { useTerminalStatus } from "../terminal/useTerminalStatus";
import { MAX_PANES_TITLE, type Leaf, type SplitNode, type TabsNode } from "./operations";
import { PANE_MIME, resolveTabIndex, usePaneDragStore } from "./paneDrag";
import { ProviderLogo } from "./ProviderLogo";
import { SessionTab } from "./SessionTab";

const PANE_CHIP =
  "flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-bg-surface px-2 text-ui-2xs font-medium text-fg-muted";
const PANE_ICON_BUTTON =
  "flex size-6 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors enabled:hover:bg-bg-hover enabled:hover:text-fg-default disabled:opacity-40";

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

interface TabPresentation {
  title: string;
  icon?: React.ReactNode;
  showTitle: boolean;
}

function presentTab(
  leaf: Leaf,
  session: ChatSession | undefined,
  manifests: CLIManifest[],
): TabPresentation {
  if (leaf.browser) return { title: "Browser", showTitle: true };
  if (!leaf.sessionId) return { title: "Open a session", showTitle: true };
  if (session?.kind !== "terminal")
    return { title: session?.title ?? "New thread", showTitle: true };

  const manifest = manifests.find((item) => item.id === session.cliProviderId);
  const name = manifest?.name ?? "Terminal";
  const named = !isGeneratedTerminalTitle(session.title, name);
  return {
    title: named ? session.title : name,
    icon: <ProviderLogo providerId={session.cliProviderId} name={name} size={14} />,
    showTitle: named,
  };
}

function TerminalStatusChip({ sessionId }: { sessionId: string }) {
  const { status, exitCode } = useTerminalStatus(sessionId);
  const label =
    status === "running"
      ? "running"
      : status === "cancelled"
        ? "cancelled"
        : exitCode !== null
          ? `exited (${exitCode})`
          : "exited";
  const dot =
    status === "running"
      ? "bg-status-success"
      : exitCode !== null && exitCode !== 0
        ? "bg-status-error"
        : "bg-fg-subtle";

  return (
    <span className={PANE_CHIP} title={label} data-terminal-status={status}>
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <span className="@max-[380px]/pane-header:hidden">{label}</span>
    </span>
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
  node: TabsNode;
  activeLeaf: Leaf;
  focused: boolean;
  status: AgentStatus;
  atCap: boolean;
  maximized: boolean;
  splitHint: string;
  onSelectTab: (leafId: string) => void;
  onRequestClose: (leafIds: string[]) => void;
  onSplit: (direction: SplitNode["direction"]) => void;
  onToggleMaximize: () => void;
}

export function PaneHeader({
  node,
  activeLeaf,
  focused,
  status,
  atCap,
  maximized,
  splitHint,
  onSelectTab,
  onRequestClose,
  onSplit,
  onToggleMaximize,
}: PaneHeaderProps) {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const modeActive = useAgentStore((state) => state.modeActive);
  const sourceLeafId = usePaneDragStore((state) => state.sourceLeafId);
  const dropTarget = usePaneDragStore((state) =>
    state.target?.groupId === node.id ? state.target : null,
  );
  const beginDrag = usePaneDragStore((state) => state.begin);
  const endDrag = usePaneDragStore((state) => state.end);

  const activeSession = activeLeaf.sessionId
    ? chatSessions.find((item) => item.id === activeLeaf.sessionId)
    : undefined;
  const activeBranch = activeSession?.worktree?.branch ?? null;
  const terminalSession = activeSession?.kind === "terminal" ? activeSession : null;
  const maximizeLabel = maximized ? "Restore" : "Maximize";
  const splitRightTitle = atCap ? MAX_PANES_TITLE : `Split right${splitHint}`;
  const splitDownTitle = atCap ? MAX_PANES_TITLE : `Split down${splitHint}`;

  const handleTabsDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const { sourceLeafId: source, setTarget } = usePaneDragStore.getState();
      if (!source) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const tabs = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>("[data-session-tab]"),
      );
      setTarget({ groupId: node.id, kind: "tab", index: resolveTabIndex(tabs, event.clientX) });
    },
    [node.id],
  );

  return (
    <div
      className="@container/pane-header flex h-tab shrink-0 items-center gap-2 border-b border-border-subtle px-1.5"
      onDragOver={handleTabsDragOver}
      onDoubleClick={(event) => {
        if (event.target instanceof Element && event.target.closest("[data-pane-actions]")) return;
        onToggleMaximize();
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {node.children.map((leaf, index) => {
          const session = leaf.sessionId
            ? chatSessions.find((item) => item.id === leaf.sessionId)
            : undefined;
          const tab = presentTab(leaf, session, cliManifests);
          return (
            <SessionTab
              key={leaf.id}
              title={tab.title}
              icon={tab.icon}
              showTitle={tab.showTitle}
              isActive={leaf.id === activeLeaf.id}
              canCloseOthers={node.children.length > 1}
              canCloseToRight={index < node.children.length - 1}
              onSelect={() => onSelectTab(leaf.id)}
              onClose={() => onRequestClose([leaf.id])}
              onCloseOthers={() =>
                onRequestClose(
                  node.children.filter((child) => child.id !== leaf.id).map((child) => child.id),
                )
              }
              onCloseToRight={() =>
                onRequestClose(node.children.slice(index + 1).map((child) => child.id))
              }
              isDragging={leaf.id === sourceLeafId}
              dropIndicator={
                dropTarget?.kind !== "tab"
                  ? null
                  : dropTarget.index === index
                    ? "before"
                    : dropTarget.index === node.children.length &&
                        index === node.children.length - 1
                      ? "after"
                      : null
              }
              onDragStart={(event) => {
                event.dataTransfer.setData(PANE_MIME, leaf.id);
                event.dataTransfer.effectAllowed = "move";
                beginDrag(leaf.id);
              }}
              onDragEnd={endDrag}
            />
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1.5" data-pane-actions="">
        {terminalSession ? (
          <TerminalStatusChip sessionId={terminalSession.id} />
        ) : activeLeaf.browser ? null : (
          <>
            {activeBranch && (
              <span
                className={PANE_CHIP}
                title={
                  activeSession?.worktree
                    ? `${activeSession.worktree.branch} ${activeSession.worktree.path}`
                    : activeBranch
                }
              >
                <GitBranch size={12} className="shrink-0" />
                <span className="max-w-[140px] truncate @max-[560px]/pane-header:hidden">
                  {activeBranch}
                </span>
              </span>
            )}
            <span className={PANE_CHIP} title={`Mode: ${modeActive ? "Agent" : "Ask"}`}>
              {modeActive ? (
                <Robot size={12} className="shrink-0" />
              ) : (
                <ChatCircle size={12} className="shrink-0" />
              )}
              <span className="@max-[460px]/pane-header:hidden">
                {modeActive ? "Agent" : "Ask"}
              </span>
            </span>
            <span
              className={cn(PANE_CHIP, status === "running" && "text-primary")}
              title={STATUS_LABELS[status]}
            >
              <span
                className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOTS[status])}
                aria-hidden="true"
              />
              <span className="@max-[380px]/pane-header:hidden">{STATUS_LABELS[status]}</span>
            </span>
          </>
        )}

        {terminalSession && focused && <TerminalMic sessionId={terminalSession.id} />}

        <div className="flex items-center gap-0.5 rounded-full border border-border-subtle p-0.5">
          {activeSession && (
            <OpenInBrowserButton session={activeSession} className={PANE_ICON_BUTTON} />
          )}
          <div className="flex items-center gap-0.5 @max-[340px]/pane-header:hidden">
            <button
              type="button"
              onClick={onToggleMaximize}
              aria-label={maximizeLabel}
              title={maximizeLabel}
              className={PANE_ICON_BUTTON}
            >
              {maximized ? <ArrowsInSimple size={13} /> : <ArrowsOutSimple size={13} />}
            </button>
            <button
              type="button"
              onClick={() => onSplit("horizontal")}
              disabled={atCap}
              aria-label="Split right"
              title={splitRightTitle}
              className={PANE_ICON_BUTTON}
            >
              <Columns size={13} />
            </button>
            <button
              type="button"
              onClick={() => onSplit("vertical")}
              disabled={atCap}
              aria-label="Split down"
              title={splitDownTitle}
              className={PANE_ICON_BUTTON}
            >
              <Rows size={13} />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="More pane actions"
                  title="More pane actions"
                  className={cn(PANE_ICON_BUTTON, "hidden @max-[340px]/pane-header:flex")}
                >
                  <DotsThree size={13} weight="bold" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={onToggleMaximize}>
                {maximized ? <ArrowsInSimple size={13} /> : <ArrowsOutSimple size={13} />}
                <span>{maximizeLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSplit("horizontal")}
                disabled={atCap}
                title={splitRightTitle}
              >
                <Columns size={13} />
                <span>Split right</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSplit("vertical")}
                disabled={atCap}
                title={splitDownTitle}
              >
                <Rows size={13} />
                <span>Split down</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => onRequestClose([activeLeaf.id])}
            aria-label="Close pane"
            title="Close pane"
            className={PANE_ICON_BUTTON}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
