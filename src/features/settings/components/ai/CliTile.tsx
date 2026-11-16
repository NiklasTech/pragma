"use client";

import { DownloadSimple, SignIn, SignOut } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Kbd } from "@/shared/components/ui/kbd";
import { cn } from "@/shared/lib/utils";
import type { CLIManifest, CLIStatus } from "@/shared/stores/ai";

interface CliTileProps {
  manifest: CLIManifest;
  status: CLIStatus | undefined;
  /** The number key that picks this CLI in quick start (⌘N). */
  quickKey: number | null;
  busy: boolean;
  onInstall: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const VERSION = /\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?/;

export function statusLine(status: CLIStatus | undefined): string {
  if (!status?.installed) return "Not installed";
  if (!status.authenticated) return "Not signed in";
  if (status.user) return `Signed in as ${status.user}`;
  // CLIs print their name around the number, for example "2.1.326 (Claude Code)".
  const version = status.version?.match(VERSION)?.[0];
  return version ? `Version ${version}` : "Ready";
}

/// One coding CLI as on Board 13: its mark, whether it is ready, and the key that starts it.
export function CliTile({
  manifest,
  status,
  quickKey,
  busy,
  onInstall,
  onSignIn,
  onSignOut,
}: CliTileProps) {
  const installed = status?.installed === true;
  const needsSignIn = installed && status?.authenticated !== true;

  return (
    <div
      className={cn(
        "group flex min-w-0 flex-col gap-1 rounded-lg border border-border-subtle px-3 py-2.5",
        !installed && "text-fg-muted",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <AgentMark
          agentId={installed ? manifest.id : undefined}
          name={manifest.name}
          className={cn(!installed && "bg-bg-active text-fg-muted")}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-ui-sm text-fg-default">{manifest.name}</span>
          <span
            className={cn(
              "truncate text-ui-xs",
              needsSignIn ? "text-status-warning" : "text-fg-muted",
            )}
          >
            {statusLine(status)}
          </span>
        </span>
        {!installed && (
          <Button size="xs" variant="ghost" onClick={onInstall} disabled={busy} className="gap-1">
            <DownloadSimple size={12} />
            {busy ? "Installing" : "Install"}
          </Button>
        )}
        {needsSignIn && (
          <Button size="xs" variant="outline" onClick={onSignIn} disabled={busy} className="gap-1">
            <SignIn size={12} />
            {busy ? "Opening" : "Sign in"}
          </Button>
        )}
        {installed && !needsSignIn && (
          <>
            <IconButton
              icon={SignOut}
              label={`Sign out of ${manifest.name}`}
              size="sm"
              onClick={onSignOut}
              className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
            />
            {quickKey !== null && (
              <Kbd aria-label={`Key ${quickKey} in quick start`}>{quickKey}</Kbd>
            )}
          </>
        )}
      </div>
      {status?.error && <p className="text-ui-xs text-status-error">{status.error}</p>}
    </div>
  );
}
