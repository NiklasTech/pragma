"use client";

import { useMemo, useState } from "react";
import { ChatCircle, Robot, SquaresFour } from "@phosphor-icons/react";

import { Input } from "@/shared/components/ui/input";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { cn } from "@/shared/lib/utils";

import { CliQuickStart } from "../home/CliQuickStart";
import { useStaleTerminalIds } from "../terminal/useStaleTerminals";
import { NewSessionButton } from "../threads/NewSessionButton";
import { collectLeaves } from "./layout";
import { providerAccent } from "./providerAccent";
import { ProviderLogo } from "./ProviderLogo";
import { selectRoot, useAgentsPanesStore } from "./store";

const RECENT_LIMIT = 6;

export function EmptyLeafView({ leafId }: { leafId: string }) {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const workspaceRoot = useFileExplorerStore((state) => state.rootPath);
  const rootPath = workspaceRoot ?? "default";
  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const assignSession = useAgentsPanesStore((state) => state.assignSession);
  const [query, setQuery] = useState("");
  const staleTerminals = useStaleTerminalIds(chatSessions, rootPath);

  const candidates = useMemo(() => {
    const shown = new Set(collectLeaves(root).map((leaf) => leaf.sessionId));
    return chatSessions
      .filter(
        (session) => !session.archived && !shown.has(session.id) && !staleTerminals.has(session.id),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chatSessions, root, staleTerminals]);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates.filter((session) => session.title.toLowerCase().includes(needle))
    : candidates;
  const visible = matches.slice(0, RECENT_LIMIT);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="m-auto flex w-full max-w-[320px] animate-in flex-col items-center gap-4 duration-200 fade-in-0 zoom-in-95">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <SquaresFour size={20} weight="fill" />
        </span>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-ui-sm font-medium text-fg-default">Empty pane</p>
          <p className="text-ui-xs text-fg-subtle">Start something new or show another thread.</p>
        </div>
        <NewSessionButton targetLeafId={leafId} size="sm" className="rounded-full" />
        {workspaceRoot && <CliQuickStart rootPath={workspaceRoot} targetLeafId={leafId} />}

        {candidates.length > 0 && (
          <div className="flex w-full flex-col gap-1.5">
            <p className="px-1 text-ui-2xs font-medium text-fg-subtle">Recent threads</p>
            {candidates.length > RECENT_LIMIT && (
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search threads"
                aria-label="Search threads"
                className="h-7 rounded-md text-ui-xs"
              />
            )}
            <div className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-bg-surface p-1">
              {visible.length === 0 ? (
                <p className="px-2.5 py-1.5 text-ui-xs text-fg-subtle">No threads match.</p>
              ) : (
                visible.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => assignSession(rootPath, leafId, session.id)}
                    className="group flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md",
                        providerAccent(session).soft,
                        providerAccent(session).text,
                      )}
                    >
                      {session.cliProviderId ? (
                        <ProviderLogo
                          providerId={session.cliProviderId}
                          name={session.title}
                          size={11}
                        />
                      ) : session.kind === "ask" ? (
                        <ChatCircle size={11} weight="fill" />
                      ) : (
                        <Robot size={11} weight="fill" />
                      )}
                    </span>
                    <span className="truncate">{session.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
