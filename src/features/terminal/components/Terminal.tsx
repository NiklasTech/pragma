import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Plus } from "@phosphor-icons/react";

import { useTerminalStore } from "@/shared/stores/terminal";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useTerminalSettingsSync } from "@/shared/hooks/useTerminalSettingsSync";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { TerminalSession } from "./TerminalSession";
import { RunTerminalSession } from "./RunTerminalSession";
import { TerminalTabs } from "./TerminalTabs";

export function Terminal() {
  useTerminalSettingsSync();
  const {
    sessions,
    activeSessionId,
    defaultShell,
    shellResolved,
    ensureInitialSession,
    reloadSession,
    addSession,
  } = useTerminalStore();
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const prevDefaultShellRef = useRef(defaultShell);
  const initialSessionGuardRef = useRef(false);

  useEffect(() => {
    if (initialSessionGuardRef.current) return;
    if (sessions.length === 0 && defaultShell.length > 0) {
      initialSessionGuardRef.current = true;
      ensureInitialSession({
        id: crypto.randomUUID(),
        name: "Terminal",
        type: "shell",
        shell: defaultShell,
        cwd: rootPath ?? undefined,
        isActive: true,
      });
    }
  }, [sessions.length, defaultShell, ensureInitialSession, rootPath]);

  useEffect(() => {
    const previous = prevDefaultShellRef.current;
    prevDefaultShellRef.current = defaultShell;

    if (previous.length > 0 && previous !== defaultShell && activeSessionId) {
      void reloadSession(activeSessionId, defaultShell);
    }
  }, [defaultShell, activeSessionId, reloadSession]);

  const showShellError = shellResolved && defaultShell.length === 0 && sessions.length === 0;

  const handleNewSession = () => {
    addSession({
      id: crypto.randomUUID(),
      name: `Terminal ${sessions.length + 1}`,
      type: "shell",
      shell: defaultShell,
      cwd: rootPath ?? undefined,
      isActive: true,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={TerminalIcon}
        title="Terminal"
        subtitle={
          sessions.length > 0
            ? `${sessions.length} session${sessions.length === 1 ? "" : "s"}`
            : undefined
        }
        actions={
          <button
            type="button"
            onClick={handleNewSession}
            disabled={!defaultShell}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40 sm:size-7 sm:rounded-lg"
            title="New Session"
          >
            <Plus size={13} weight="bold" />
          </button>
        }
      />
      <TerminalTabs sessions={sessions} activeSessionId={activeSessionId} />
      <div className="relative flex-1 min-h-0">
        {showShellError ? (
          <PanelEmptyState
            icon={TerminalIcon}
            title="No shell available"
            description="Pragma could not resolve a default shell. Check your PATH or set a shell in Settings > Terminal."
          />
        ) : (
          sessions.map((session) =>
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
