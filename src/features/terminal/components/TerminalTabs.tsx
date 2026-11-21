import { useEffect, useState } from "react";
import { Command, Cube, Play, Terminal, TerminalWindow, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { ActionContextMenu } from "@/shared/components/ui/action-menu";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { middleClickToClose } from "@/shared/lib/middleClick";
import { handleTabListKeyDown } from "@/shared/lib/tabListKeys";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useTerminalStore, type TerminalSession } from "@/shared/stores/terminal";
import { terminalRepository } from "../terminalRepository";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";

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
  const killSession = useTerminalStore((s) => s.killSession);
  const renameSession = useTerminalStore((s) => s.renameSession);
  const activity = useTerminalStore((s) => s.activity);
  const repositories = useOpenRepositoriesStore((s) => s.paths);
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
    <div
      role="tablist"
      aria-label="Terminal sessions"
      onKeyDown={handleTabListKeyDown}
      className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1.5"
    >
      {sessions.map((session, index) => {
        const isActive = session.id === activeSessionId;
        const isTabStop =
          isActive || (!sessions.some((s) => s.id === activeSessionId) && index === 0);
        const isRunning = now - (activity[session.id] ?? 0) < 2000;
        const SessionIcon = sessionIcon(session);
        const repository =
          repositories.length > 1 ? terminalRepository(session, repositories) : null;

        return (
          <ActionContextMenu
            key={session.id}
            menu={() => ({
              head: `${session.name} · ${session.type}`,
              tone: isRunning ? "info" : "idle",
              groups: [
                {
                  items: [
                    {
                      key: "r",
                      label: "rename",
                      onSelect: () => {
                        setDraft(session.name);
                        setEditingId(session.id);
                      },
                    },
                  ],
                },
                {
                  items: [
                    {
                      key: "x",
                      label: "close terminal",
                      danger: true,
                      onSelect: () => void killSession(session.id),
                    },
                  ],
                },
              ],
            })}
          >
            <div
              role="tab"
              aria-selected={isActive}
              tabIndex={isTabStop ? 0 : -1}
              data-active={isActive}
              onClick={() =>
                panelId && useTerminalStore.getState().setActiveSession(panelId, session.id)
              }
              onDoubleClick={() => {
                setDraft(session.name);
                setEditingId(session.id);
              }}
              {...middleClickToClose(() => void killSession(session.id))}
              className={cn("pragma-pill-tab group cursor-default", isActive && "data-active=true")}
            >
              {isRunning && <span className="size-1.5 shrink-0 rounded-full bg-status-success" />}
              <SessionIcon size={13} className="shrink-0 text-fg-muted" />
              {editingId === session.id ? (
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(session)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(session);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-24 rounded-[5px] px-1 py-0"
                />
              ) : (
                <span className="max-w-[140px] truncate" title="Double-click to rename">
                  {session.name}
                </span>
              )}
              {repository && editingId !== session.id && (
                <span
                  className="flex max-w-[100px] min-w-0 items-center gap-1 text-ui-2xs text-fg-subtle"
                  title={repository}
                >
                  <RepositoryColorDot path={repository} className="size-1.5" />
                  <span className="truncate">{getWorkspaceName(repository)}</span>
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  void killSession(session.id);
                }}
                className="ml-0.5 size-4 text-fg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Close ${session.name}`}
                tabIndex={isActive ? 0 : -1}
              >
                <X size={12} />
              </Button>
            </div>
          </ActionContextMenu>
        );
      })}
    </div>
  );
}
