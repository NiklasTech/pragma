import { accountKey, accountLabel, type CliAccount } from "@/shared/stores/ai/cliAccounts";

import { fullestWindow } from "../subscription/nearLimit";
import type { SubscriptionUsage, UsageWindow } from "../subscription/types";

/** Another account of the same CLI that can take over the session. */
export interface AccountOption {
  account: CliAccount;
  label: string;
  /** The fullest usage window of the account, when its plan reports one. */
  fullest: UsageWindow | null;
}

/** The usage window a session's card is about: its id and when it resets. */
export function windowKey(window: UsageWindow | null): string {
  return window ? `${window.id}:${window.resetsAtMs ?? "none"}` : "limit";
}

/** The other signed-in accounts of the CLI, the one with the most room first. */
export function otherAccounts(
  accounts: readonly CliAccount[],
  providerId: string,
  currentDir: string | null,
  usage: (account: CliAccount) => SubscriptionUsage | null,
  names: Record<string, string>,
  now: number,
): AccountOption[] {
  const current = accountKey(providerId, currentDir);
  return accounts
    .filter(
      (account) =>
        account.providerId === providerId &&
        account.available &&
        account.signedIn &&
        accountKey(account.providerId, account.configDir) !== current,
    )
    .map((account) => ({
      account,
      label: accountLabel(account, names),
      fullest: fullestWindow(usage(account), now),
    }))
    .sort((a, b) => (a.fullest?.usedPercent ?? 0) - (b.fullest?.usedPercent ?? 0));
}

/** "23:40" for a reset time, in the local clock. */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
