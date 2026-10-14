"use client";

import { useMemo } from "react";
import { Chat, ChatCircle, GitBranch, Robot, Terminal, UsersThree } from "@phosphor-icons/react";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAIStore, type CLIManifest } from "@/shared/stores/ai";

import { joinableWorktrees } from "../sessions/shared";
import type { SessionMenuCliRow } from "./session-menu";
import type { NewSessionActions } from "./useNewSessionActions";

interface JoinWorktreeMenuProps {
  cliRows: SessionMenuCliRow[];
  findManifest: (manifestId: string) => CLIManifest | undefined;
  actions: NewSessionActions;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** New session > Join worktree of...: starts a session in the worktree other sessions use. */
export function JoinWorktreeMenu({ cliRows, findManifest, actions }: JoinWorktreeMenuProps) {
  const environments = useAIStore((state) => state.workEnvironments);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const worktrees = useMemo(
    () => joinableWorktrees(environments, chatSessions),
    [environments, chatSessions],
  );
  if (worktrees.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <UsersThree size={14} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">Join worktree of...</span>
            <span className="truncate text-ui-2xs text-fg-subtle">
              Work next to another session
            </span>
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-72">
          {worktrees.map(({ environment, sessions }) => {
            const titles = sessions.map((session) => session.title).join(", ");
            return (
              <DropdownMenuSub key={environment.id}>
                <DropdownMenuSubTrigger title={`${environment.branch} ${environment.path}`}>
                  <GitBranch size={14} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{titles}</span>
                    <span className="truncate text-ui-2xs text-fg-subtle">
                      {environment.branch} · {plural(sessions.length, "session")}
                    </span>
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64">
                  <DropdownMenuItem
                    onClick={() => void actions.joinWorktree(environment.id, { kind: "ask" })}
                  >
                    <ChatCircle size={14} />
                    Ask
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="whitespace-normal">
                    Edits the same files as {sessions.length === 1 ? "the session" : "the sessions"}{" "}
                    in this worktree
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => void actions.joinWorktree(environment.id, { kind: "agent" })}
                  >
                    <Robot size={14} />
                    Agent
                  </DropdownMenuItem>
                  {cliRows.flatMap((row) =>
                    row.items.map((item) => (
                      <DropdownMenuItem
                        key={`${row.manifestId}:${item.action}`}
                        onClick={() => {
                          const manifest = findManifest(row.manifestId);
                          if (!manifest) return;
                          void actions.joinWorktree(environment.id, {
                            kind: "cli",
                            manifest,
                            action: item.action,
                          });
                        }}
                      >
                        {item.action === "conversation" ? (
                          <Chat size={13} />
                        ) : (
                          <Terminal size={13} />
                        )}
                        <span className="flex-1 truncate">
                          {row.items.length > 1 ? `${row.name} ${item.label}` : row.name}
                        </span>
                      </DropdownMenuItem>
                    )),
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}
