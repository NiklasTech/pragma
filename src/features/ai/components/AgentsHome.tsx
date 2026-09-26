"use client";

import { useCallback, useEffect, useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { defaultEnvironment, type WorktreeChoice } from "@/features/ai/worktree/choice";
import { createSessionForChoice } from "@/features/ai/worktree/create";
import { useWorktreeChoiceStore } from "@/features/ai/worktree/remember";

import { useAgentsPanesStore } from "../panes/store";
import { homePromptLabel, isHomePromptSubmitKey, trimHomePrompt } from "../home/homePrompt";
import { clearPendingFirstMessage, setPendingFirstMessage } from "../home/pendingFirstMessage";

interface RepoCheckResult {
  is_repo: boolean;
  reason: string | null;
}

export function AgentsHome() {
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<WorktreeChoice | null>(null);
  const [repoCheck, setRepoCheck] = useState<RepoCheckResult | null>(null);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const createChatSession = useAIStore((state) => state.createChatSession);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const openSession = useAgentsPanesStore((state) => state.openSession);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const rememberedChoice = useWorktreeChoiceStore((state) =>
    rootPath ? state.choices[rootPath] : undefined,
  );
  const setChoice = useWorktreeChoiceStore((state) => state.setChoice);

  const writingMode = agentModeActive;
  const recommended = defaultEnvironment(chatSessions, rememberedChoice);
  const canChooseWorktree = writingMode && repoCheck?.is_repo === true;
  const choice: WorktreeChoice = picked ?? recommended;

  useEffect(() => {
    setPicked(null);
    setRepoCheck(null);
  }, [rootPath]);

  useEffect(() => {
    if (!writingMode || !rootPath) return;
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

  const startThread = useCallback(async () => {
    if (!rootPath || creating) return;

    setCreating(true);
    setError(null);

    const text = trimHomePrompt(prompt);
    if (text) {
      setPendingFirstMessage(text);
    } else {
      clearPendingFirstMessage();
    }

    try {
      let session: ChatSession | null;
      if (canChooseWorktree) {
        setChoice(rootPath, choice);
        session = await createSessionForChoice(rootPath, choice);
      } else if (writingMode) {
        session = await createSessionForChoice(rootPath, "checkout");
      } else {
        session = await createChatSession(rootPath, { kind: "ask", environment: "checkout" });
      }

      if (!session) {
        clearPendingFirstMessage();
        setError("Could not start the thread.");
        return;
      }

      openSession(rootPath, session.id);
      setPrompt("");
    } catch {
      clearPendingFirstMessage();
      setError("Could not start the thread.");
    } finally {
      setCreating(false);
    }
  }, [
    canChooseWorktree,
    choice,
    createChatSession,
    creating,
    openSession,
    prompt,
    rootPath,
    setChoice,
    writingMode,
  ]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto px-6 py-10">
      <div className="flex w-full max-w-[720px] flex-col items-center gap-4">
        <h1 className="text-center text-ui-lg font-semibold text-fg-default">
          Ask Pragma to work in this folder
        </h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void startThread();
          }}
          className="w-full rounded-xl border border-border/60 bg-bg-elevated p-3 shadow-[var(--shadow-sm)] transition-colors focus-within:border-primary/40"
        >
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (isHomePromptSubmitKey(event)) {
                event.preventDefault();
                void startThread();
              }
            }}
            rows={3}
            placeholder="Describe what you want to build, fix or explain."
            disabled={!rootPath}
            className="min-h-16 resize-none border-0 bg-transparent px-1 py-1 text-ui-md shadow-none focus-visible:bg-transparent focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="min-w-0 flex-1">
              {!rootPath && (
                <span className="truncate text-ui-xs text-fg-subtle">
                  Open a folder to start a thread.
                </span>
              )}
              {error && (
                <span role="alert" className="truncate text-ui-xs text-status-error">
                  {error}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canChooseWorktree && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!rootPath || creating}
                      >
                        {choice === "worktree" ? "New worktree" : "This checkout"}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setPicked("checkout")}>
                      This checkout
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPicked("worktree")}>
                      New worktree
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button type="submit" size="sm" disabled={!rootPath || creating}>
                <PaperPlaneRight size={13} weight="bold" />
                {homePromptLabel(prompt)}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
