"use client";

import { FolderOpen, FolderPlus, X } from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";

import { Button } from "@/shared/components/ui/button";

interface AgentFoldersTabProps {
  folders: string[];
  onChange: (folders: string[]) => void;
}

export function AgentFoldersTab({ folders, onChange }: AgentFoldersTabProps) {
  const addFolder = async () => {
    const path = await open({ multiple: false, directory: true });
    if (typeof path === "string" && path.length > 0 && !folders.includes(path)) {
      onChange([...folders, path]);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-ui-xs text-fg-subtle">
        Empty means only the folder that is open when a chat starts.
      </p>
      <div className="flex flex-col gap-1">
        {folders.map((folder) => (
          <div
            key={folder}
            className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5"
          >
            <FolderOpen size={14} className="shrink-0 text-fg-subtle" />
            <span className="min-w-0 flex-1 truncate text-ui-xs text-fg-default" title={folder}>
              {folder}
            </span>
            <button
              type="button"
              aria-label={`Remove ${folder}`}
              title="Remove folder"
              onClick={() => onChange(folders.filter((item) => item !== folder))}
              className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-bg-hover hover:text-status-error"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={addFolder}>
        <FolderPlus size={14} />
        Add folder
      </Button>
    </div>
  );
}
