import { useEffect, useRef } from "react";

import { useTerminalStore } from "@/shared/stores/terminal";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useTerminalSettingsSync } from "@/shared/hooks/useTerminalSettingsSync";
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TerminalTabs sessions={sessions} activeSessionId={activeSessionId} />
      <div className="relative flex-1 min-h-0">
        {showShellError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-ui-sm font-medium text-fg-default">No shell available</span>
            <span className="max-w-md text-ui-xs text-fg-muted">
              Pragma could not resolve a default shell. Check your PATH or set a shell in Settings
              &gt; Terminal.
            </span>
          </div>
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
