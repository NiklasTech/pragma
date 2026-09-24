"use client";

import { CheckCircle, SignIn, SignOut } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAIStore } from "@/shared/stores/ai";

interface CopilotBlockProps {
  clientIdInput: string;
  authenticated: boolean;
  polling: boolean;
  error: string | null;
  userCode: string | null;
  verificationUri: string | null;
  onClientIdInputChange: (value: string) => void;
  onUserCodeChange: (value: string | null) => void;
  onVerificationUriChange: (value: string | null) => void;
  onPollingChange: (polling: boolean) => void;
  onErrorChange: (error: string | null) => void;
}

export function CopilotBlock({
  clientIdInput,
  authenticated,
  polling,
  error,
  userCode,
  verificationUri,
  onClientIdInputChange,
  onUserCodeChange,
  onVerificationUriChange,
  onPollingChange,
  onErrorChange,
}: CopilotBlockProps) {
  const aiStore = useAIStore();

  const handleCopilotConnect = async () => {
    const clientId = clientIdInput.trim();
    if (!clientId) return;

    onErrorChange(null);
    onUserCodeChange(null);
    onVerificationUriChange(null);
    onPollingChange(true);

    try {
      const start = await aiStore.startCopilotDeviceLogin(clientId);
      onUserCodeChange(start.user_code);
      onVerificationUriChange(start.verification_uri);

      const verificationUrl = `${start.verification_uri}?user_code=${encodeURIComponent(start.user_code)}`;
      void invoke("open_external_url", { url: verificationUrl });

      const deadline = Date.now() + start.expires_in * 1000;
      const poll = async () => {
        if (Date.now() >= deadline) {
          onPollingChange(false);
          onErrorChange("Login code expired. Please try again.");
          return;
        }

        try {
          const authorized = await aiStore.pollCopilotDeviceLogin(clientId, start.device_code);
          if (authorized) {
            onPollingChange(false);
            onUserCodeChange(null);
            onVerificationUriChange(null);
            return;
          }
          setTimeout(poll, start.interval * 1000);
        } catch (err) {
          onPollingChange(false);
          onErrorChange(String(err));
        }
      };

      setTimeout(poll, start.interval * 1000);
    } catch (err) {
      onPollingChange(false);
      onErrorChange(String(err));
    }
  };

  const handleCopilotDisconnect = async () => {
    await aiStore.logoutCopilot();
    onUserCodeChange(null);
    onVerificationUriChange(null);
    onErrorChange(null);
  };

  const handleOpenVerificationUrl = () => {
    if (verificationUri && userCode) {
      void invoke("open_external_url", {
        url: `${verificationUri}?user_code=${encodeURIComponent(userCode)}`,
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border/30 bg-bg-root p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-ui-sm text-fg-default">GitHub OAuth Client ID</span>
        <span className="text-ui-xs text-fg-muted">
          Create a GitHub OAuth App and paste its Client ID here.
        </span>
        <Input
          value={clientIdInput}
          onChange={(e) => {
            onClientIdInputChange(e.target.value);
            aiStore.setCopilotClientId(e.target.value);
          }}
          placeholder="e.g. Iv23li..."
          disabled={polling || authenticated}
        />
      </div>

      {authenticated ? (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1 text-ui-xs text-status-success">
            <CheckCircle size={14} /> Connected to GitHub Copilot
          </span>
          <Button size="sm" variant="outline" onClick={handleCopilotDisconnect} disabled={polling}>
            <SignOut size={14} className="mr-1" />
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={handleCopilotConnect}
          disabled={!clientIdInput.trim() || polling}
        >
          <SignIn size={14} className="mr-1" />
          {polling ? "Waiting for authorization..." : "Connect GitHub Account"}
        </Button>
      )}

      {userCode && verificationUri && (
        <div className="flex flex-col gap-1.5">
          <span className="text-ui-xs text-fg-muted">
            Enter this code on GitHub if the browser did not open:
          </span>
          <code className="rounded bg-bg-surface px-2 py-1 text-center text-sm font-mono">
            {userCode}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenVerificationUrl}
            disabled={polling}
          >
            Open GitHub
          </Button>
        </div>
      )}

      {error && <p className="text-ui-xs text-status-error">{error}</p>}
    </div>
  );
}
