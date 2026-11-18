"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Warning } from "@phosphor-icons/react";
import { toast } from "sonner";

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
import type { McpServerConfig } from "@/shared/stores/settings";

import { cliName, type McpCli } from "./cliMcp";

interface PendingShare {
  server: McpServerConfig;
  cli: McpCli;
  secrets: string[];
}

function secretNames(server: McpServerConfig): string[] {
  return [...server.secretEnv, ...(server.secretHeaders ?? [])];
}

/// Writes a server into a coding CLI's user config. A server with secrets asks first, since
/// the CLI reads them in plain text from that file instead of the keychain.
export function useMcpShare(onShared: () => void) {
  const [pending, setPending] = React.useState<PendingShare | null>(null);

  const run = React.useCallback(
    async (server: McpServerConfig, cli: McpCli, includeSecrets: boolean) => {
      try {
        const file = await invoke<string>("mcp_share_server", {
          id: server.id,
          cli,
          includeSecrets,
        });
        toast.success(`${cliName(cli)} now lists ${server.name} in ${file}`);
        onShared();
      } catch (err) {
        toast.error(String(err));
      }
    },
    [onShared],
  );

  const share = React.useCallback(
    (server: McpServerConfig, cli: McpCli) => {
      const secrets = secretNames(server);
      if (secrets.length > 0) setPending({ server, cli, secrets });
      else void run(server, cli, false);
    },
    [run],
  );

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Warning size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>Write secrets in plain text?</AlertDialogTitle>
          <AlertDialogDescription>
            {pending
              ? `${cliName(pending.cli)} reads ${pending.secrets.join(", ")} of ${pending.server.name} from its config file, not from the keychain. Pragma writes ${pending.secrets.length === 1 ? "the value" : "the values"} there in plain text.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pending) void run(pending.server, pending.cli, true);
              setPending(null);
            }}
          >
            Share
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { share, dialog };
}
