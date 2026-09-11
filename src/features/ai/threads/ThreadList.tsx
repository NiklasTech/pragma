"use client";

import { useCallback, useMemo, useState } from "react";
import { MagnifyingGlass, Plus, Warning } from "@phosphor-icons/react";

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
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";

import { resolveThreadStatus } from "./helpers";
import { ThreadRow } from "./ThreadRow";

const SEARCH_THRESHOLD = 8;

export function ThreadList() {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const setActiveChatSession = useAIStore((state) => state.setActiveChatSession);
  const createChatSession = useAIStore((state) => state.createChatSession);
  const renameChatSession = useAIStore((state) => state.renameChatSession);
  const deleteSession = useAIStore((state) => state.deleteSession);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const agentStatus = useAgentStore((state) => state.status);

  const [query, setQuery] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const sortedSessions = useMemo(
    () => [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [chatSessions],
  );

  const visibleSessions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sortedSessions;
    return sortedSessions.filter((session) => session.title.toLowerCase().includes(trimmed));
  }, [query, sortedSessions]);

  const handleNewThread = useCallback(() => {
    if (!rootPath) return;
    void createChatSession(rootPath);
  }, [createChatSession, rootPath]);

  const handleRename = useCallback(
    (sessionId: string, title: string) => {
      void renameChatSession(rootPath ?? "default", sessionId, title);
    },
    [renameChatSession, rootPath],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!sessionToDelete) return;
    void deleteSession(rootPath ?? "default", sessionToDelete);
    setSessionToDelete(null);
  }, [deleteSession, rootPath, sessionToDelete]);

  const sessionToDeleteTitle = chatSessions.find((s) => s.id === sessionToDelete)?.title ?? "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-2 px-2 py-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleNewThread}
          disabled={!rootPath}
          className="w-full justify-start"
        >
          <Plus size={13} weight="bold" />
          New thread
        </Button>

        {chatSessions.length > SEARCH_THRESHOLD && (
          <div className="relative">
            <MagnifyingGlass
              size={12}
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-fg-subtle"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search threads"
              aria-label="Search threads"
              className="h-6 pl-7 text-ui-xs"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {visibleSessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-ui-xs text-fg-subtle">
            {chatSessions.length === 0 ? "No threads yet." : "No threads match your search."}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleSessions.map((session) => (
              <ThreadRow
                key={session.id}
                session={session}
                isActive={session.id === activeChatSessionId}
                status={resolveThreadStatus(agentStatus, session.id === activeChatSessionId)}
                onSelect={setActiveChatSession}
                onRename={handleRename}
                onDelete={setSessionToDelete}
              />
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
    </div>
  );
}
