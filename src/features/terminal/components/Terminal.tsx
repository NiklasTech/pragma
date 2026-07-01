import { useEffect, useRef } from "react";

import { useTerminalStore } from "@/shared/stores/terminal";
import { useTerminalSettingsSync } from "@/shared/hooks/useTerminalSettingsSync";
import { TerminalSession } from "./TerminalSession";
import { TerminalTabs } from "./TerminalTabs";

export function Terminal() {
  useTerminalSettingsSync();
  const { sessions, activeSessionId, defaultShell, addSession, reloadSession } = useTerminalStore();
  const prevDefaultShellRef = useRef(defaultShell);

  useEffect(() => {
    if (sessions.length === 0 && defaultShell.length > 0) {
      addSession({
        id: crypto.randomUUID(),
        name: "Terminal",
        type: "shell",
        shell: defaultShell,
        isActive: true,
      });
    }
  }, [sessions.length, defaultShell, addSession]);

  useEffect(() => {
    const previous = prevDefaultShellRef.current;
    prevDefaultShellRef.current = defaultShell;

    if (previous.length > 0 && previous !== defaultShell && activeSessionId) {
      void reloadSession(activeSessionId, defaultShell);
    }
  }, [defaultShell, activeSessionId, reloadSession]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TerminalTabs sessions={sessions} activeSessionId={activeSessionId} />
      <div className="relative flex-1 min-h-0">
        {sessions.map((session) => (
          <TerminalSession
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
          />
        ))}
      </div>
    </div>
  );
}
