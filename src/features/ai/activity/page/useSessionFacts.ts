import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { sessionAccountLabel, useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { useSettingsStore } from "@/shared/stores/settings";

import { sessionAgentManifest } from "../../sessions/sessionAgent";
import { sessionEnvironment } from "../../worktree/cwd";
import { sessionCliProvider } from "../../subscription/summary";
import { engineLabel } from "../dashboard";

export interface SessionFacts {
  agent: string;
  /** The CLI account, set when the CLI has several. */
  account: string | null;
  /** The worktree branch, or "checkout". */
  where: string;
}

/// Who runs a session and where, as the activity rows show it.
export function useSessionFacts(session: ChatSession): SessionFacts {
  const manifests = useAIStore((state) => state.cliManifests);
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const workEnvironments = useAIStore((state) => state.workEnvironments);
  const manifest = useAIStore((state) => sessionAgentManifest(state, session.id));
  const accounts = useCliAccountsStore((state) => state.accounts);
  const names = useSettingsStore((state) => state.ai.cliAccounts.names);

  const environment = sessionEnvironment(session, workEnvironments);
  return {
    agent: engineLabel(session, manifests, { provider: activeProvider, model: activeModel }),
    // Only a CLI session runs with an account; Pragma's own chat has none.
    account: sessionCliProvider(session)
      ? sessionAccountLabel(accounts, names, manifest?.id, session.cliAccountDir)
      : null,
    where: environment?.kind === "worktree" ? environment.branch : "checkout",
  };
}
