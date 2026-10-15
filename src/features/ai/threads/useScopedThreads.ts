import { useMemo } from "react";

import { useAIStore, type ChatSession, type WorkEnvironment } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { useRepositoryEnvironments, useRepositorySessions } from "../sessions/repositorySessions";

export type ThreadScope = "repository" | "all";

interface ScopedThreads {
  paths: string[];
  /** The list groups the threads of several open repositories. */
  allRepositories: boolean;
  sessions: ChatSession[];
  environments: WorkEnvironment[];
}

/// The threads of the active repository, or those of every open repository.
export function useScopedThreads(scope: ThreadScope): ScopedThreads {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeSessions = useRepositorySessions();
  const activeEnvironments = useRepositoryEnvironments();
  const chatSessions = useAIStore((state) => state.chatSessions);
  const workEnvironments = useAIStore((state) => state.workEnvironments);
  const allRepositories = scope === "all" && paths.length > 1;

  const sessions = useMemo(
    () =>
      allRepositories
        ? chatSessions.filter((session) => paths.includes(session.rootPath))
        : activeSessions,
    [activeSessions, allRepositories, chatSessions, paths],
  );
  const environments = useMemo(
    () =>
      allRepositories
        ? workEnvironments.filter((environment) => paths.includes(environment.rootPath))
        : activeEnvironments,
    [activeEnvironments, allRepositories, paths, workEnvironments],
  );

  return { paths, allRepositories, sessions, environments };
}
