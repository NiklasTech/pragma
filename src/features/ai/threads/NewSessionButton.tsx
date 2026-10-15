"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useRepositoryWorkspaceSettings } from "@/shared/stores/workspaceSettings/repositories";
import { useAgentStore } from "@/features/agent/store";
import { MAX_PANES, MAX_PANES_TITLE } from "../panes/operations";
import { selectLeafCount, useAgentsPanesStore } from "../panes/store";
import { defaultEnvironment } from "../sessions/environment";
import { useRepositorySessions } from "../sessions/repositorySessions";
import { RepositoryMenuPicker } from "../sessions/RepositoryPicker";
import { useRepositoryChoice } from "../sessions/useRepositoryChoice";

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
  const repository = useRepositoryChoice();
  const rootPath = repository.rootPath;
  const pickable = targetLeafId === undefined && rootPath !== null && repository.paths.length > 1;
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const chatSessions = useRepositorySessions(rootPath ?? undefined);
  const setting = useRepositoryWorkspaceSettings(rootPath)?.agent?.writingSessions;
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
      defaultChoice={defaultEnvironment(chatSessions, setting)}
      actions={actions}
      disabledReason={atCap && !targetLeafId ? MAX_PANES_TITLE : undefined}
      repositoryPicker={
        pickable ? (
          <RepositoryMenuPicker
            paths={repository.paths}
            value={rootPath}
            onChange={repository.pick}
          />
        ) : undefined
      }
      onOpen={repository.reset}
      className={className}
      variant={variant}
      size={size}
    />
  );
}
