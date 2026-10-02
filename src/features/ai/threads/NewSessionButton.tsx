"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { MAX_PANES, MAX_PANES_TITLE } from "../panes/operations";
import { selectLeafCount, useAgentsPanesStore } from "../panes/store";
import { defaultEnvironment } from "../worktree/choice";
import { useWorktreeChoiceStore } from "../worktree/remember";

import { NewSessionMenu } from "./NewSessionMenu";
import { useNewSessionActions } from "./useNewSessionActions";

interface RepoCheckResult {
  is_repo: boolean;
  reason: string | null;
}

interface NewSessionButtonProps {
  targetLeafId?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
}

export function NewSessionButton({
  targetLeafId,
  className,
  variant,
  size,
}: NewSessionButtonProps) {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const rememberedChoice = useWorktreeChoiceStore((state) =>
    rootPath ? state.choices[rootPath] : undefined,
  );
  const actions = useNewSessionActions(rootPath, targetLeafId);
  const atCap = useAgentsPanesStore(
    (state) => selectLeafCount(state, rootPath ?? "default") >= MAX_PANES,
  );
  const [repoCheck, setRepoCheck] = useState<RepoCheckResult | null>(null);

  useEffect(() => {
    if (!agentModeActive || !rootPath) {
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
  }, [agentModeActive, rootPath]);

  return (
    <NewSessionMenu
      rootPath={rootPath}
      isRepo={repoCheck?.is_repo === true}
      defaultChoice={defaultEnvironment(chatSessions, rememberedChoice)}
      actions={actions}
      disabledReason={atCap && !targetLeafId ? MAX_PANES_TITLE : undefined}
      className={className}
      variant={variant}
      size={size}
    />
  );
}
