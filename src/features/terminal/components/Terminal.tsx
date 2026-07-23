import { useEffect, useRef } from "react";
import {
  Terminal as TerminalIcon,
  Plus,
  SplitHorizontal,
  Broom,
  Copy,
  X,
} from "@phosphor-icons/react";

import { useTerminalStore } from "@/shared/stores/terminal";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useTerminalSettingsSync } from "@/shared/hooks/useTerminalSettingsSync";
import { useLayoutStore } from "@/shell/layout";
import { findPanelByKind } from "@/shell/layout/tree/operations";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { Button } from "@/shared/components/ui/button";
import { dispatchTerminalClear, dispatchTerminalCopyOutput } from "@/shared/lib/terminal-events";
import { TerminalSession } from "./TerminalSession";
import { RunTerminalSession } from "./RunTerminalSession";
import { TerminalTabs } from "./TerminalTabs";

interface TerminalProps {
  panelId?: string;
}

export function Terminal({ panelId }: TerminalProps) {
  useTerminalSettingsSync();
  const { sessions, activeByPanel, defaultShell, shellResolved, reloadSession, addSession } =
    useTerminalStore();
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const prevDefaultShellRef = useRef(defaultShell);
  const initialSessionGuardRef = useRef(false);

  // Orphan sessions without a panelId are shown in the first terminal panel.
  const layoutRoot = useLayoutStore((s) => s.root);
  const firstTerminalPanelId = findPanelByKind(layoutRoot, "terminal")?.id;
  const panelSessions = sessions.filter(
    (s) => s.panelId === panelId || (s.panelId == null && panelId === firstTerminalPanelId),
  );
  const activeSessionId =
    (panelId ? activeByPanel[panelId] : undefined) ??
    panelSessions[panelSessions.length - 1]?.id ??
    null;

  useEffect(() => {
    if (initialSessionGuardRef.current) return;
    if (panelSessions.length === 0 && defaultShell.length > 0) {
      initialSessionGuardRef.current = true;
      useTerminalStore.getState().ensureInitialSession({
        id: crypto.randomUUID(),
        name: "Terminal",
        type: "shell",
        shell: defaultShell,
        cwd: rootPath ?? undefined,
        panelId,
        isActive: true,
      });
    }
  }, [panelSessions.length, defaultShell, rootPath, panelId]);

  useEffect(() => {
    const previous = prevDefaultShellRef.current;
    prevDefaultShellRef.current = defaultShell;

    if (previous.length > 0 && previous !== defaultShell && activeSessionId) {
      void reloadSession(activeSessionId, defaultShell);
    }
  }, [defaultShell, activeSessionId, reloadSession]);

  const showShellError = shellResolved && defaultShell.length === 0 && panelSessions.length === 0;

  const handleNewSession = () => {
    addSession({
      id: crypto.randomUUID(),
      name: `Terminal ${panelSessions.length + 1}`,
      type: "shell",
      shell: defaultShell,
      cwd: rootPath ?? undefined,
      panelId,
      isActive: true,
    });
  };

  const handleSplit = () => {
    if (panelId) {
      useLayoutStore.getState().splitPanel(panelId, "horizontal", "terminal");
    }
  };

  const handleClosePanel = () => {
    if (panelId) {
      useLayoutStore.getState().closePanel(panelId);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-bg-surface">
      <PanelHeader
        icon={TerminalIcon}
        title="Terminal"
        subtitle={
          panelSessions.length > 0
            ? `${panelSessions.length} session${panelSessions.length === 1 ? "" : "s"}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={dispatchTerminalCopyOutput}
              disabled={panelSessions.length === 0}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40 sm:size-7 sm:rounded-lg"
              title="Copy Output"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={dispatchTerminalClear}
              disabled={panelSessions.length === 0}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40 sm:size-7 sm:rounded-lg"
              title="Clear Terminal"
            >
              <Broom size={13} />
            </button>
            {panelId && (
              <button
                type="button"
                onClick={handleSplit}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default sm:size-7 sm:rounded-lg"
                title="Split Terminal Right"
              >
                <SplitHorizontal size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={handleNewSession}
              disabled={!defaultShell}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40 sm:size-7 sm:rounded-lg"
              title="New Session"
            >
              <Plus size={13} weight="bold" />
            </button>
            {panelId && (
              <button
                type="button"
                onClick={handleClosePanel}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-status-error sm:size-7 sm:rounded-lg"
                title="Close Panel"
              >
                <X size={13} weight="bold" />
              </button>
            )}
          </div>
        }
      />
      <TerminalTabs sessions={panelSessions} activeSessionId={activeSessionId} panelId={panelId} />
      <div className="relative flex-1 min-h-0">
        {showShellError ? (
          <PanelEmptyState
            icon={TerminalIcon}
            title="No shell available"
            description="Pragma could not resolve a default shell. Check your PATH or set a shell in Settings > Terminal."
          />
        ) : panelSessions.length === 0 ? (
          <PanelEmptyState
            icon={TerminalIcon}
            title="No sessions"
            description="Start a new shell session in this panel."
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
              disabled={!defaultShell}
              className="gap-2"
            >
              <Plus size={14} />
              New Session
            </Button>
          </PanelEmptyState>
        ) : (
          panelSessions.map((session) =>
            session.type === "run" ? (
              <RunTerminalSession
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
              />
            ) : (
              <TerminalSession
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
