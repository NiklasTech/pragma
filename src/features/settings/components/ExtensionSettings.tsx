"use client";

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowsClockwise,
  FolderOpen,
  PuzzlePiece,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  installExtensionFromPath,
  loadWorkspaceExtensions,
  removeExtension,
  setExtensionRunning,
} from "@/features/extensions/host";
import { useExtensionsStore, type ExtensionRuntimeState } from "@/features/extensions/store";
import type { ExtensionSummary } from "@/features/extensions/types";
import { SettingSection } from "./ui/SettingSection";

function statusOf(
  statuses: Record<string, ExtensionRuntimeState>,
  id: string,
): ExtensionRuntimeState {
  return statuses[id] ?? { status: "disabled" };
}

export function ExtensionSettings() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const summaries = useExtensionsStore((s) => s.summaries);
  const statuses = useExtensionsStore((s) => s.statuses);
  const extensionSettings = useSettingsStore((s) => s.extensions);

  const handleReload = () => {
    if (!rootPath) return;
    void loadWorkspaceExtensions(rootPath).catch((err: unknown) => {
      toast.error(`Failed to load extensions: ${String(err)}`);
    });
  };

  const handleInstall = async () => {
    if (!rootPath) return;
    const selected = await open({ multiple: false, directory: true });
    if (!selected || Array.isArray(selected)) return;
    try {
      await installExtensionFromPath(rootPath, selected);
      toast.success("Extension installed");
    } catch (err) {
      toast.error(`Failed to install extension: ${String(err)}`);
    }
  };

  const handleRemove = async (id: string) => {
    if (!rootPath) return;
    try {
      await removeExtension(rootPath, id);
      toast.success("Extension removed");
    } catch (err) {
      toast.error(`Failed to remove extension: ${String(err)}`);
    }
  };

  const handleOpenFolder = async () => {
    if (!rootPath) return;
    try {
      await invoke("extension_open_folder", { workspaceRoot: rootPath });
    } catch (err) {
      toast.error(`Failed to open extensions folder: ${String(err)}`);
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    if (!rootPath) return;
    void setExtensionRunning(rootPath, id, enabled);
  };

  if (!rootPath) {
    return (
      <SettingSection title="Extensions">
        <div className="flex flex-col items-center gap-2 py-6 text-center text-ui-sm text-fg-muted">
          <PuzzlePiece size={28} className="text-fg-subtle" />
          <span>Open a folder to manage workspace extensions.</span>
        </div>
      </SettingSection>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Installed Extensions">
        <div className="flex justify-end gap-2 py-2">
          <Button variant="outline" size="xs" onClick={handleReload} className="gap-1">
            <ArrowsClockwise size={14} />
            Reload
          </Button>
          <Button variant="outline" size="xs" onClick={handleOpenFolder} className="gap-1">
            <FolderOpen size={14} />
            Open Folder
          </Button>
          <Button variant="outline" size="xs" onClick={handleInstall} className="gap-1">
            <UploadSimple size={14} />
            Install from Folder
          </Button>
        </div>

        {summaries.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-ui-sm text-fg-muted">
            <PuzzlePiece size={28} className="text-fg-subtle" />
            <span>No extensions installed.</span>
            <span className="text-ui-xs text-fg-subtle">
              Extensions live in .pragma/extensions inside the workspace. See docs/EXTENSIONS.md for
              the manifest format and API.
            </span>
          </div>
        )}

        {summaries.map((summary) => (
          <ExtensionRow
            key={summary.id}
            summary={summary}
            runtime={statusOf(statuses, summary.id)}
            enabled={extensionSettings[summary.id]?.enabled ?? true}
            onToggle={(enabled) => handleToggle(summary.id, enabled)}
            onRemove={() => void handleRemove(summary.id)}
          />
        ))}
      </SettingSection>
    </div>
  );
}

interface ExtensionRowProps {
  summary: ExtensionSummary;
  runtime: ExtensionRuntimeState;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

function ExtensionRow({ summary, runtime, enabled, onToggle, onRemove }: ExtensionRowProps) {
  const isError = runtime.status === "error" || summary.error !== null;
  const error = runtime.error ?? summary.error;

  return (
    <div className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-ui-sm font-medium text-fg-default">{summary.name}</span>
            {summary.version && (
              <span className="text-ui-xs text-fg-subtle">v{summary.version}</span>
            )}
            {isError && (
              <span className="rounded-full bg-status-error/10 px-1.5 py-0.5 text-ui-xs text-status-error">
                Error
              </span>
            )}
            {!isError && runtime.status === "running" && (
              <span className="rounded-full bg-status-success/10 px-1.5 py-0.5 text-ui-xs text-status-success">
                Running
              </span>
            )}
          </div>
          {summary.description && (
            <span className="text-ui-xs text-fg-muted">{summary.description}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={enabled && !isError}
            disabled={isError}
            onCheckedChange={onToggle}
            aria-label={`Enable ${summary.name}`}
          />
          <button
            type="button"
            onClick={onRemove}
            className="flex size-6 items-center justify-center rounded text-fg-muted hover:bg-bg-hover hover:text-status-error"
            aria-label={`Remove ${summary.name}`}
          >
            <Trash size={14} />
          </button>
        </div>
      </div>
      {isError && error && <span className="text-ui-xs text-status-error">{error}</span>}
    </div>
  );
}
