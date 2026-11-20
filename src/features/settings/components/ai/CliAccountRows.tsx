"use client";

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { PencilSimple, Plus, X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { Kbd } from "@/shared/components/ui/kbd";
import { cn } from "@/shared/lib/utils";
import {
  accountKey,
  accountLabel,
  accountsOf,
  loadCliAccounts,
  useCliAccountsStore,
  type CliAccount,
} from "@/shared/stores/ai/cliAccounts";
import { useSettingsStore } from "@/shared/stores/settings";

/** CLIs that keep each account in a config folder of its own. */
export const ACCOUNT_PROVIDERS = new Set(["anthropic-claude", "openai-codex"]);

function homePath(path: string): string {
  return path.replace(/^\/(Users|home)\/[^/]+/, "~");
}

/** Where the account lives, and its email when the name does not already show it. */
function detail(account: CliAccount, label: string): string {
  if (!account.available) return "folder not found";
  const where = account.configDir ? homePath(account.configDir) : "default folder";
  if (!account.signedIn) return `not signed in · ${where}`;
  if (!account.email || account.email === label) return where;
  return `${account.email} · ${where}`;
}

interface CliAccountRowsProps {
  providerId: string;
  /** The quick start key of each account, by its folder ("" for the default). */
  quickKeyOf: (configDir: string | null) => number | null;
}

/// The accounts of one CLI, each with a name, and a way to add another account's folder.
export function CliAccountRows({ providerId, quickKeyOf }: CliAccountRowsProps) {
  const allAccounts = useCliAccountsStore((state) => state.accounts);
  const accounts = accountsOf(allAccounts, providerId);
  const settings = useSettingsStore((state) => state.ai.cliAccounts);
  const setAISettings = useSettingsStore((state) => state.setAISettings);
  const [renaming, setRenaming] = useState<CliAccount | null>(null);

  const isAdded = (dir: string) =>
    settings.folders.some((folder) => folder.providerId === providerId && folder.dir === dir);

  const save = (next: Partial<typeof settings>) => {
    setAISettings({ cliAccounts: { ...settings, ...next } });
    void loadCliAccounts();
  };

  const addFolder = async () => {
    const folder = await open({ directory: true, multiple: false, title: "Account folder" });
    if (typeof folder !== "string" || isAdded(folder)) return;
    save({ folders: [...settings.folders, { providerId, dir: folder }] });
  };

  const rename = (account: CliAccount, name: string) => {
    const names = { ...settings.names };
    const key = accountKey(account.providerId, account.configDir);
    if (name.trim()) names[key] = name.trim();
    else delete names[key];
    save({ names });
  };

  const remove = (account: CliAccount) => {
    const names = { ...settings.names };
    delete names[accountKey(account.providerId, account.configDir)];
    save({
      folders: settings.folders.filter(
        (folder) => folder.providerId !== providerId || folder.dir !== account.configDir,
      ),
      names,
    });
  };

  return (
    <div className="flex flex-col pb-1 pl-7.5">
      {accounts.length > 1 &&
        accounts.map((account) => {
          const quickKey = quickKeyOf(account.configDir);
          const added = account.configDir !== null && isAdded(account.configDir);
          return (
            <div
              key={account.configDir ?? "default"}
              className="group/account flex min-h-6.5 min-w-0 items-center gap-2.5"
            >
              <span className="text-fg-subtle" aria-hidden="true">
                └
              </span>
              <span
                className={cn(
                  "max-w-40 shrink-0 truncate font-mono text-ui-xs",
                  account.available ? "text-fg-default" : "text-fg-muted",
                )}
              >
                {accountLabel(account, settings.names)}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-mono text-ui-2xs",
                  account.available && account.email ? "text-fg-subtle" : "text-status-warning",
                )}
                title={account.configDir ?? undefined}
              >
                {detail(account, accountLabel(account, settings.names))}
              </span>
              <span className="flex shrink-0 items-center opacity-0 group-focus-within/account:opacity-100 group-hover/account:opacity-100">
                <IconButton
                  icon={PencilSimple}
                  label={`Rename ${accountLabel(account, settings.names)}`}
                  size="sm"
                  onClick={() => setRenaming(account)}
                />
                {added && (
                  <IconButton
                    icon={X}
                    label={`Remove ${accountLabel(account, settings.names)}`}
                    size="sm"
                    onClick={() => remove(account)}
                  />
                )}
              </span>
              {quickKey !== null && (
                <Kbd aria-label={`Key ${quickKey} in quick start`}>{quickKey}</Kbd>
              )}
            </div>
          );
        })}
      <Button
        variant="ghost"
        size="xs"
        onClick={() => void addFolder()}
        title="Add account folder"
        className="w-fit gap-1 px-1 font-mono text-ui-2xs font-normal text-fg-subtle"
      >
        <Plus size={11} aria-hidden="true" />
        add account folder
      </Button>
      <InputDialog
        open={renaming !== null}
        onOpenChange={(isOpen) => !isOpen && setRenaming(null)}
        title="Name this account"
        description="Shown wherever you pick the agent."
        label="Name"
        defaultValue={
          renaming ? (settings.names[accountKey(providerId, renaming.configDir)] ?? "") : ""
        }
        confirmLabel="Save"
        onConfirm={(name) => {
          if (renaming) rename(renaming, name);
          setRenaming(null);
        }}
      />
    </div>
  );
}
