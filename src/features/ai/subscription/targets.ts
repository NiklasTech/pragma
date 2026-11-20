import { choosableAccounts, type CliAccount } from "@/shared/stores/ai/cliAccounts";

/** One plan whose usage is shown: a CLI's default account, or one of its accounts. */
export interface UsageTarget {
  providerId: string;
  configDir: string | null;
  /** The account, set when the CLI has several. */
  account: CliAccount | null;
}

/// Each account of a CLI with several accounts, else the CLI's default account.
export function usageTargets(
  providerIds: readonly string[],
  accounts: readonly CliAccount[],
): UsageTarget[] {
  return providerIds.flatMap((providerId): UsageTarget[] => {
    const several = choosableAccounts(accounts, providerId);
    if (several.length === 0) return [{ providerId, configDir: null, account: null }];
    return several.map((account) => ({ providerId, configDir: account.configDir, account }));
  });
}
