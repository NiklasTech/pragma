import type { CLIManifest } from "@/shared/stores/ai";
import { accountLabel, choosableAccounts, type CliAccount } from "@/shared/stores/ai/cliAccounts";

import type { QuickAgent } from "./quickStart";

/** One agent to pick: a CLI, or one account of a CLI that has several. */
export interface QuickChoice {
  manifest: CLIManifest;
  agent: Extract<QuickAgent, { kind: "cli" }>;
  /** Set when the CLI has several accounts. */
  accountLabel: string | null;
}

/** Ready CLIs in order, a CLI with several accounts once per account. */
export function quickChoices(
  ready: readonly CLIManifest[],
  accounts: readonly CliAccount[],
  names: Record<string, string>,
): QuickChoice[] {
  return ready.flatMap((manifest): QuickChoice[] => {
    const choices = choosableAccounts(accounts, manifest.id);
    if (choices.length === 0) {
      return [{ manifest, agent: { kind: "cli", manifestId: manifest.id }, accountLabel: null }];
    }
    return choices.map((account) => ({
      manifest,
      agent: account.configDir
        ? { kind: "cli", manifestId: manifest.id, accountDir: account.configDir }
        : { kind: "cli", manifestId: manifest.id },
      accountLabel: accountLabel(account, names),
    }));
  });
}

/** Same CLI and same account. */
export function sameAgent(a: QuickAgent, b: QuickAgent): boolean {
  if (a.kind === "terminal" || b.kind === "terminal") return a.kind === b.kind;
  return a.manifestId === b.manifestId && a.accountDir === b.accountDir;
}
