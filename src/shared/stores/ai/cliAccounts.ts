import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { useSettingsStore } from "@/shared/stores/settings";

/** One account of a coding CLI; `configDir` is null for the CLI's default account. */
export interface CliAccount {
  providerId: string;
  configDir: string | null;
  email: string | null;
  displayName: string | null;
  organizationName: string | null;
  available: boolean;
}

interface CliAccountsStore {
  accounts: CliAccount[];
}

export const useCliAccountsStore = create<CliAccountsStore>()(() => ({ accounts: [] }));

/** The key names are stored under, stable across sign-ins. */
export function accountKey(providerId: string, configDir: string | null | undefined): string {
  return `${providerId}:${configDir ?? "default"}`;
}

function folderName(configDir: string): string {
  return configDir.split(/[\\/]/).filter(Boolean).pop() ?? configDir;
}

/** The name the user gave, else the signed-in email, else the folder. */
export function accountLabel(account: CliAccount, names: Record<string, string>): string {
  const name = names[accountKey(account.providerId, account.configDir)]?.trim();
  if (name) return name;
  if (account.email) return account.email;
  return account.configDir ? folderName(account.configDir) : "default";
}

/** A CLI's accounts, in the order the backend found them. */
export function accountsOf(accounts: readonly CliAccount[], providerId: string): CliAccount[] {
  return accounts.filter((account) => account.providerId === providerId);
}

/** Only CLIs with more than one usable account offer a choice. */
export function choosableAccounts(
  accounts: readonly CliAccount[],
  providerId: string,
): CliAccount[] {
  const usable = accountsOf(accounts, providerId).filter((account) => account.available);
  return usable.length > 1 ? usable : [];
}

/** The label of a session's account, or null when the CLI has only one account. */
export function sessionAccountLabel(
  accounts: readonly CliAccount[],
  names: Record<string, string>,
  providerId: string | undefined,
  configDir: string | undefined,
): string | null {
  if (!providerId || accountsOf(accounts, providerId).length < 2) return null;
  const account = accounts.find(
    (item) => item.providerId === providerId && item.configDir === (configDir ?? null),
  );
  return account ? accountLabel(account, names) : configDir ? folderName(configDir) : null;
}

/// Lists the accounts again; cheap, it reads a few config files.
export async function loadCliAccounts(): Promise<void> {
  const { addedDirs } = useSettingsStore.getState().ai.cliAccounts;
  try {
    const accounts = await invoke<CliAccount[]>("cli_accounts_list", { addedDirs });
    useCliAccountsStore.setState({ accounts });
  } catch {
    // Tauri is unavailable outside the desktop runtime.
  }
}
