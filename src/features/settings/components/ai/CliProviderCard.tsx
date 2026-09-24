"use client";

import { DownloadSimple, Robot, SignIn, SignOut } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import type { CLIManifest, CLIStatus } from "@/shared/stores/ai";

interface CliProviderCardProps {
  manifest: CLIManifest;
  status: CLIStatus | undefined;
  isActive: boolean;
  isInstalling: boolean;
  isLoggingIn: boolean;
  onInstall: () => void;
  onLogin: () => void;
  onSelect: () => void;
  onLogout: () => void;
}

export function CliProviderCard({
  manifest,
  status,
  isActive,
  isInstalling,
  isLoggingIn,
  onInstall,
  onLogin,
  onSelect,
  onLogout,
}: CliProviderCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-md border border-border/30 bg-bg-root p-3 ${isActive ? "ring-1 ring-primary" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Robot size={16} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ui-base font-medium">{manifest.name}</span>
            {status?.installed && (
              <span className="rounded-full bg-status-success/10 px-1.5 py-0.5 text-ui-xs text-status-success">
                Installed
              </span>
            )}
            {status?.authenticated && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-ui-xs text-primary">
                Connected
              </span>
            )}
          </div>
          <p className="text-ui-xs text-fg-muted">{manifest.description}</p>
          {status?.version && <p className="text-ui-xs text-fg-muted">v{status.version}</p>}
          {status?.user && <p className="text-ui-xs text-fg-muted">Signed in as {status.user}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!status?.installed && (
          <Button size="sm" variant="outline" onClick={onInstall} disabled={isInstalling}>
            <DownloadSimple size={14} className="mr-1" />
            {isInstalling ? "Installing..." : "Install Official CLI"}
          </Button>
        )}

        {status?.installed && !status?.authenticated && (
          <Button size="sm" variant="outline" onClick={onLogin} disabled={isLoggingIn}>
            <SignIn size={14} className="mr-1" />
            {isLoggingIn ? "Opening login..." : "Login with CLI"}
          </Button>
        )}

        {status?.authenticated && (
          <>
            <Button size="sm" variant={isActive ? "default" : "outline"} onClick={onSelect}>
              {isActive ? "Active" : "Use This"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onLogout}>
              <SignOut size={14} className="mr-1" />
              Disconnect
            </Button>
          </>
        )}
      </div>

      {status?.error && <p className="text-ui-xs text-status-error">{status.error}</p>}
    </div>
  );
}
