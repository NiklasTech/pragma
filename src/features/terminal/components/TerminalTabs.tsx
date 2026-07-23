import { useEffect, useState } from "react";
import { Command, Cube, Play, Terminal, TerminalWindow, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { useTerminalStore, type TerminalSession } from "@/shared/stores/terminal";

interface TerminalTabsProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  panelId?: string;
}

function sessionIcon(session: TerminalSession): Icon {
  if (session.type === "run") return Play;
  if (session.type === "docker-logs" || session.type === "docker-exec") return Cube;
  const shell = (session.shell ?? "").split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (shell.includes("pwsh") || shell.includes("powershell")) return TerminalWindow;
  if (shell.startsWith("cmd")) return Command;
  return Terminal;
}

export function TerminalTabs({ sessions, activeSessionId, panelId }: TerminalTabsProps) {
  const { killSession, renameSession } = useTerminalStore();
  const activity = useTerminalStore((s) => s.activity);
  const [now, setNow] = useState(() => Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (sessions.length === 0) {
    return null;
  }

  const commitRename = (session: TerminalSession) => {
    const name = draft.trim();
    if (name && name !== session.name) {
      renameSession(session.id, name);
    }
    setEditingId(null);
  };

  return (
    <div className="flex h-tab shrink-0 items-center gap-1 overflow-x-auto px-2">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        const isRunning = now - (activity[session.id] ?? 0) < 2000;
        const SessionIcon = sessionIcon(session);

        return (
          <div
            key={session.id}
            data-active={isActive}
            onClick={() =>
              panelId && useTerminalStore.getState().setActiveSession(panelId, session.id)
            }
            onDoubleClick={() => {
              setDraft(session.name);
              setEditingId(session.id);
            }}
            className={cn("pragma-pill-tab group cursor-default", isActive && "data-active=true")}
          >
            {isRunning && <span className="size-1.5 shrink-0 rounded-full bg-status-success" />}
            <SessionIcon size={13} className="shrink-0 text-fg-muted" />
            {editingId === session.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitRename(session)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(session);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-24 rounded-sm bg-bg-input px-1 py-0 text-ui-sm text-fg-default outline-none"
              />
            ) : (
              <span className="max-w-[140px] truncate" title="Double-click to rename">
                {session.name}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void killSession(session.id);
              }}
              className="ml-0.5 rounded-sm p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-fg-default group-hover:opacity-100"
              aria-label={`Close ${session.name}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
