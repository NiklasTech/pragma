"use client";

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowsClockwise, FolderOpen, Trash, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";
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
import { STATE_CELL_CLASSES } from "@/shell/chrome/SessionMark";
import { SettingSection } from "./ui/SettingSection";

const GRID =
  "grid grid-cols-[10px_minmax(0,1fr)_6.5rem_minmax(4.5rem,auto)_auto] items-center gap-3";

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
        <p className="py-3 text-[12.5px] text-fg-subtle">
          Open a folder to see the extensions in its .pragma/extensions.
        </p>
      </SettingSection>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SettingSection
        title="Extensions"
        badge={summaries.length > 0 ? { label: String(summaries.length) } : undefined}
        action={
          <>
            <Button variant="outline" size="xs" onClick={handleReload} className="gap-1">
              <ArrowsClockwise size={12} />
              Reload
            </Button>
            <Button variant="outline" size="xs" onClick={handleOpenFolder} className="gap-1">
              <FolderOpen size={12} />
              Folder
            </Button>
            <Button variant="outline" size="xs" onClick={handleInstall} className="gap-1">
              <UploadSimple size={12} />
              Install
            </Button>
          </>
        }
      >
        {summaries.length === 0 && (
          <p className="py-3 text-[12.5px] leading-relaxed text-fg-muted">
            No extensions in .pragma/extensions yet. An extension adds commands and views to Pragma
            only; agents do not see it. docs/EXTENSIONS.md has the manifest format and API.
          </p>
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
  const running = !isError && runtime.status === "running";

  return (
    <div className={cn(GRID, "min-h-11 py-1.5")}>
      <span
        aria-hidden="true"
        className={cn(
          "size-2 justify-self-center rounded-[1.5px]",
          isError ? "bg-status-error" : STATE_CELL_CLASSES[running ? "done" : "idle"],
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5 font-mono">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[12.5px] font-medium text-fg-default">{summary.name}</span>
          {summary.version && (
            <span className="shrink-0 text-[11px] text-fg-subtle">{summary.version}</span>
          )}
        </span>
        {isError && error ? (
          <span className="text-[11px] break-words text-status-error">{error}</span>
        ) : (
          summary.description && (
            <span className="truncate text-[11px] text-fg-subtle">{summary.description}</span>
          )
        )}
      </span>
      <span
        className={cn(
          "font-mono text-[11.5px]",
          isError ? "text-status-error" : running ? "text-fg-muted" : "text-fg-subtle",
        )}
      >
        {isError ? "failed" : running ? "running" : "off"}
      </span>
      <span className="font-mono text-[11px] text-fg-subtle">pragma only</span>
      <span className="flex items-center justify-end gap-1">
        <Switch
          checked={enabled && !isError}
          disabled={isError}
          onCheckedChange={onToggle}
          aria-label={`Enable ${summary.name}`}
        />
        <IconButton
          icon={Trash}
          label={`Remove ${summary.name}`}
          size="sm"
          onClick={onRemove}
          className="text-fg-muted hover:text-status-error"
        />
      </span>
    </div>
  );
}
