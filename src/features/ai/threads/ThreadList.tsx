"use client";

import { useCallback, useMemo, useState } from "react";
import { MagnifyingGlass, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Input } from "@/shared/components/ui/input";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { DiscardWorktreeDialog } from "@/features/ai/worktree/DiscardWorktreeDialog";
import { PanePresetsMenu } from "@/features/ai/panes/PanePresetsMenu";

import { NewSessionButton } from "./NewSessionButton";
import { groupThreadsByRecency, resolveThreadStatus } from "./helpers";
import { ThreadRow } from "./ThreadRow";

const SEARCH_THRESHOLD = 8;

export function ThreadList() {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const renameChatSession = useAIStore((state) => state.renameChatSession);
  const deleteSession = useAIStore((state) => state.deleteSession);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const openSession = useAgentsPanesStore((state) => state.openSession);

  const [query, setQuery] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [discardSessionId, setDiscardSessionId] = useState<string | null>(null);

  const sortedSessions = useMemo(
    () => [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [chatSessions],
  );

  const visibleSessions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sortedSessions;
    return sortedSessions.filter((session) => session.title.toLowerCase().includes(trimmed));
  }, [query, sortedSessions]);

  const groups = useMemo(
    () =>
      groupThreadsByRecency(
        visibleSessions,
        (session) => resolveThreadStatus(agentStatus, session.id, runSessionId) !== "idle",
      ),
    [agentStatus, runSessionId, visibleSessions],
  );

  const handleSelect = useCallback(
    (sessionId: string) => {
      openSession(rootPath ?? "default", sessionId);
    },
    [openSession, rootPath],
  );

  const handleRename = useCallback(
    (sessionId: string, title: string) => {
      void renameChatSession(rootPath ?? "default", sessionId, title);
    },
    [renameChatSession, rootPath],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!sessionToDelete) return;
    try {
      await deleteSession(rootPath ?? "default", sessionToDelete);
      setSessionToDelete(null);
    } catch {
      toast.error("Failed to delete thread");
    }
  }, [deleteSession, rootPath, sessionToDelete]);

  const sessionToDeleteTitle = chatSessions.find((s) => s.id === sessionToDelete)?.title ?? "";
  const discardSession = chatSessions.find((s) => s.id === discardSessionId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-2 pb-1">
        <NewSessionButton
          variant="secondary"
          className="h-8 w-full justify-start gap-2 rounded-full px-3.5 text-ui-sm"
        />

        <div className="flex h-7 items-center gap-1 pr-0.5 pl-2">
          <span className="text-ui-xs font-semibold text-fg-default">Threads</span>
          {chatSessions.length > 0 && (
            <span className="text-ui-xs text-fg-subtle tabular-nums">{chatSessions.length}</span>
          )}
          <span className="flex-1" />
          <PanePresetsMenu />
        </div>

        {chatSessions.length > SEARCH_THRESHOLD && (
          <div className="relative">
            <MagnifyingGlass
              size={12}
              weight="bold"
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-fg-subtle"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search threads"
              aria-label="Search threads"
              className="h-7 rounded-md pl-7 text-ui-xs"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
        {visibleSessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-ui-xs text-fg-subtle">
            {chatSessions.length === 0 ? "No threads yet." : "No threads match your search."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label} className="flex flex-col gap-0.5">
                <h3 className="px-2 pb-0.5 text-ui-2xs font-medium text-fg-subtle">
                  {group.label}
                </h3>
                {group.items.map((session) => (
                  <ThreadRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeChatSessionId}
                    status={resolveThreadStatus(agentStatus, session.id, runSessionId)}
                    onSelect={handleSelect}
                    onRename={handleRename}
                    onDelete={setSessionToDelete}
                    onDiscard={setDiscardSessionId}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={sessionToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Warning size={20} className="text-status-warning" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{sessionToDeleteTitle}&quot;? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DiscardWorktreeDialog
        session={discardSession}
        rootPath={rootPath ?? "default"}
        open={discardSessionId !== null}
        onOpenChange={(open) => {
          if (!open) setDiscardSessionId(null);
        }}
      />
    </div>
  );
}
