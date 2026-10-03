"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Key, SignOut } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";

interface McpSignInButtonProps {
  serverId: string;
  serverName: string;
  /** The server answered that it needs authorization. */
  authRequired: boolean;
}

/// OAuth sign-in and sign-out for a remote MCP server.
export function McpSignInButton({ serverId, serverName, authRequired }: McpSignInButtonProps) {
  const [signedIn, setSignedIn] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => {
    void invoke<boolean>("mcp_oauth_status", { id: serverId })
      .then(setSignedIn)
      .catch(() => setSignedIn(false));
  }, [serverId]);

  React.useEffect(refresh, [refresh, authRequired]);

  const signIn = async () => {
    setBusy(true);
    const toastId = `mcp-oauth-${serverId}`;
    toast.loading(`Sign in to ${serverName} in your browser`, { id: toastId });
    try {
      await invoke("mcp_oauth_authorize", { id: serverId });
      toast.success(`Signed in to ${serverName}`, { id: toastId });
    } catch (err) {
      toast.error(String(err), { id: toastId });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await invoke("mcp_oauth_sign_out", { id: serverId });
      toast.success(`Signed out of ${serverName}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  if (signedIn && !authRequired) {
    return (
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => void signOut()}
        title="Sign out"
        disabled={busy}
      >
        <SignOut size={14} />
      </Button>
    );
  }

  return (
    <Button
      variant={authRequired ? "outline" : "ghost"}
      size={authRequired ? "xs" : "icon-xs"}
      onClick={() => void signIn()}
      title="Sign in with OAuth"
      disabled={busy}
      className={authRequired ? "gap-1 border-status-warning/40 text-status-warning" : undefined}
    >
      <Key size={14} />
      {authRequired && "Sign in"}
    </Button>
  );
}
