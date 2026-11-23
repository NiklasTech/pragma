import { toast } from "sonner";

import { useAIStore } from "@/shared/stores/ai";
import { useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";

import { findLeafBySession } from "../panes/operations";
import { paneTreeKey, selectRoot, useAgentsPanesStore } from "../panes/store";
import { selectProviderUsage, useSubscriptionUsageStore } from "../subscription/store";
import { continueWithAccount } from "./actions";
import { otherAccounts } from "./options";

const CLAUDE = "anthropic-claude";

/**
 * Hands a Claude Code session that hit its limit to the account with the most room, in its pane.
 * False when there is none with room, or the session shows in no pane of the open folder.
 */
export async function switchOnLimit(sessionId: string): Promise<boolean> {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  if (!session || session.kind !== "terminal" || session.cliProviderId !== CLAUDE) return false;
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) return false;
  const panes = useAgentsPanesStore.getState();
  const leaf = findLeafBySession(selectRoot(panes, paneTreeKey(rootPath)), sessionId);
  if (!leaf) return false;

  const { agent, ai } = useSettingsStore.getState();
  const usage = useSubscriptionUsageStore.getState();
  const [best] = otherAccounts(
    useCliAccountsStore.getState().accounts,
    CLAUDE,
    session.cliAccountDir ?? null,
    (account) => selectProviderUsage(usage, CLAUDE, account.configDir).usage,
    ai.cliAccounts.names,
    Date.now(),
  );
  if (!best || (best.fullest !== null && best.fullest.usedPercent >= agent.limitThreshold)) {
    return false;
  }
  await continueWithAccount(rootPath, leaf.id, session, best.account.configDir);
  toast.info(`Claude Code reached its usage limit and went on with ${best.label}`);
  return true;
}
