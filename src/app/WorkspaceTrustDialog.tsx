"use client";

import { ShieldWarning } from "@phosphor-icons/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";
import {
  resolveTrust,
  securityKey,
  useWorkspaceTrustStore,
} from "@/shared/stores/workspaceSettings/trust";

/// Asks once per workspace before its file may let the agent run commands without approval.
export function WorkspaceTrustDialog() {
  const rootPath = useWorkspaceSettingsStore((state) => state.rootPath);
  const settings = useWorkspaceSettingsStore((state) => state.settings);
  const decisions = useWorkspaceTrustStore((state) => state.decisions);
  const decide = useWorkspaceTrustStore((state) => state.decide);

  const trust = resolveTrust(rootPath, settings, decisions);
  const key = securityKey(settings);
  if (trust !== "pending" || !rootPath || key === null) return null;

  const commands = settings?.agent?.allowedCommands ?? [];

  return (
    <AlertDialog open onOpenChange={(open) => !open && decide(rootPath, key, false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldWarning size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>Trust this workspace's agent settings?</AlertDialogTitle>
          <AlertDialogDescription>
            .pragma/settings.json in this folder lets the agent run these commands without asking.
            Only trust it if you know who wrote it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border-subtle bg-bg-surface px-3 py-2">
          {commands.map((command) => (
            <li key={command} className="truncate font-mono text-ui-xs text-fg-default">
              {command}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => decide(rootPath, key, false)}>
            Don't allow
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => decide(rootPath, key, true)}>Allow</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
