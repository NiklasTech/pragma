"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Folder, GitBranch, MagnifyingGlass, Plus, Warning } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
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
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { defaultEnvironment, type WorktreeChoice } from "@/features/ai/worktree/choice";
import { createSessionForChoice } from "@/features/ai/worktree/create";
import { DiscardWorktreeDialog } from "@/features/ai/worktree/DiscardWorktreeDialog";
import { useWorktreeChoiceStore } from "@/features/ai/worktree/remember";

import { resolveThreadStatus } from "./helpers";
import { ThreadRow } from "./ThreadRow";

const SEARCH_THRESHOLD = 8;

interface RepoCheckResult {
  is_repo: boolean;
  reason: string | null;
}

export function ThreadList() {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const createChatSession = useAIStore((state) => state.createChatSession);
  const renameChatSession = useAIStore((state) => state.renameChatSession);
  const deleteSession = useAIStore((state) => state.deleteSession);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const openSession = useAgentsPanesStore((state) => state.openSession);
  const rememberedChoice = useWorktreeChoiceStore((state) =>
    rootPath ? state.choices[rootPath] : undefined,
  );
  const setChoice = useWorktreeChoiceStore((state) => state.setChoice);

  const writingMode = agentModeActive;
  const defaultChoice = defaultEnvironment(chatSessions, rememberedChoice);

  const [query, setQuery] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [discardSessionId, setDiscardSessionId] = useState<string | null>(null);
  const [repoCheck, setRepoCheck] = useState<RepoCheckResult | null>(null);

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
    const create = writingMode
      ? createSessionForChoice(rootPath, "checkout")
      : createChatSession(rootPath, { kind: "ask", environment: "checkout" });
    void create.then((session) => {
      if (session) openSession(rootPath, session.id);
    });
  }, [createChatSession, openSession, rootPath, writingMode]);

  useEffect(() => {
    if (!writingMode || !rootPath) {
      setRepoCheck(null);
      return;
    }
    let cancelled = false;
    void invoke<RepoCheckResult>("git_session_repo_check", { repoPath: rootPath })
      .then((result) => {
        if (!cancelled) setRepoCheck(result);
      })
      .catch(() => {
        if (!cancelled) setRepoCheck({ is_repo: false, reason: null });
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, writingMode]);

  const handleChoose = useCallback(
    (choice: WorktreeChoice) => {
      if (!rootPath) return;
      setChoice(rootPath, choice);
      void createSessionForChoice(rootPath, choice)
        .then((session) => {
          if (session) openSession(rootPath, session.id);
        })
        .catch(() => {
          toast.error("Could not start the thread");
        });
    },
    [openSession, rootPath, setChoice],
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
      <div className="flex shrink-0 flex-col gap-2 p-2">
        {writingMode && repoCheck?.is_repo ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="default"
                  disabled={!rootPath}
                  className="w-full justify-start rounded-lg"
                >
                  <Plus size={13} weight="bold" />
                  New thread
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={() => handleChoose("checkout")}>
                <Folder size={13} />
                <span className="flex-1">This checkout</span>
                {defaultChoice === "checkout" && <Check size={13} className="text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChoose("worktree")}>
                <GitBranch size={13} />
                <span className="flex-1">New worktree</span>
                {defaultChoice === "worktree" && <Check size={13} className="text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            size="default"
            onClick={handleNewThread}
            disabled={!rootPath}
            className="w-full justify-start rounded-lg"
          >
            <Plus size={13} weight="bold" />
            New thread
          </Button>
        )}

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
              className="h-7 rounded-lg pl-7 text-ui-xs"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {visibleSessions.length === 0 ? (
          <p className="mx-1 rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-ui-xs text-fg-subtle">
            {chatSessions.length === 0 ? "No threads yet." : "No threads match your search."}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleSessions.map((session) => (
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
