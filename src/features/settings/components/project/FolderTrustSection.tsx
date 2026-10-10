import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { loadWorkspaceExtensions } from "@/features/extensions/host";
import { useFolderTrustStore } from "@/shared/stores/workspaceSettings/trust";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";

interface TrustStatus {
  trusted: boolean | null;
  content: { extensions: string[]; scripts: string[] };
}

/// Whether this folder may run its own extensions, worktree scripts and allowed agent commands.
/// Changing it asks in a native dialog, so a page in the app cannot answer for the user.
export function FolderTrustSection({ rootPath }: { rootPath: string }) {
  const [status, setStatus] = React.useState<TrustStatus | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    invoke<TrustStatus>("workspace_trust_status", { rootPath })
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  if (!status) return null;
  const { extensions, scripts } = status.content;

  const change = async () => {
    setBusy(true);
    try {
      const trusted = await useFolderTrustStore.getState().change(rootPath);
      setStatus({ ...status, trusted });
      await loadWorkspaceExtensions(rootPath);
    } catch (err) {
      toast.error("Could not change folder trust", { description: String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingSection
      title="Folder trust"
      badge={
        status.trusted === true
          ? { label: "Trusted", variant: "success" }
          : { label: "Not trusted", variant: "warning" }
      }
      action={
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => void change()}>
          Change
        </Button>
      }
    >
      {extensions.length === 0 && scripts.length === 0 && (
        <SettingRow
          label="Restricted mode"
          description="An untrusted folder opens normally but runs no extensions or worktree scripts, and its allowed commands still ask first."
          control={null}
        />
      )}
      {extensions.length > 0 && (
        <SettingRow
          label="Extensions"
          description="Run when the folder opens."
          control={<span className="text-ui-sm text-fg-muted">{extensions.join(", ")}</span>}
        />
      )}
      {scripts.length > 0 && (
        <SettingRow
          label="Worktree scripts"
          description="Run when a session gets its own worktree."
          control={<span className="text-ui-sm text-fg-muted">{scripts.join(", ")}</span>}
        />
      )}
    </SettingSection>
  );
}
