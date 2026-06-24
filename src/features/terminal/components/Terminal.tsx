import { useEffect, useRef } from "react";

import { useTerminalStore } from "@/shared/stores/terminal";
import { useTerminalSettingsSync } from "@/shared/hooks/useTerminalSettingsSync";
import { TerminalSession } from "./TerminalSession";
import { TerminalTabs } from "./TerminalTabs";

export function Terminal() {
  useTerminalSettingsSync();
  const { sessions, activeSessionId, defaultShell, addSession } = useTerminalStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (sessions.length === 0) {
      void addSession({
        id: crypto.randomUUID(),
        name: "Terminal",
        type: "shell",
        shell: defaultShell,
        isActive: true,
      });
    }
  }, [sessions.length, defaultShell, addSession]);

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
