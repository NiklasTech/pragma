"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useSettingsStore } from "@/shared/stores/settings";

import { newCandidates, type McpImportCandidate } from "./tools/cliMcp";
import { importMcpCandidates } from "./tools/mcpImport";
import { McpImportList } from "./tools/McpImportList";

interface McpImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the open folder and the CLI configs list, read by the caller. */
  candidates: McpImportCandidate[];
  loaded: boolean;
  onImported: () => void;
}

/// Imports servers from the workspace, the coding CLI configs and Claude Desktop.
export function McpImportDialog({
  open,
  onOpenChange,
  candidates,
  loaded,
  onImported,
}: McpImportDialogProps) {
  const [selected, setSelected] = React.useState<Set<McpImportCandidate>>(new Set());
  const [importing, setImporting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const existing = useSettingsStore.getState().mcp.servers.map((s) => s.name);
    setSelected(new Set(newCandidates(candidates, existing)));
  }, [open, candidates]);

  const importSelected = async () => {
    setImporting(true);
    const picked = candidates.filter((candidate) => selected.has(candidate));
    const error = await importMcpCandidates(picked);
    setImporting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(`Imported ${picked.length} MCP ${picked.length === 1 ? "server" : "servers"}`);
    }
    onImported();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Import MCP servers</DialogTitle>
          <DialogDescription>
            From this folder, the configs of Claude Code, Codex, Gemini CLI and Cursor, and Claude
            Desktop. Secrets go to the OS keychain.
          </DialogDescription>
        </DialogHeader>

        {!loaded && <p className="text-ui-xs text-fg-muted">Looking for servers...</p>}
        {loaded && candidates.length === 0 && (
          <p className="text-ui-xs text-fg-muted">No servers found to import.</p>
        )}
        <div className="max-h-72 overflow-y-auto">
          <McpImportList candidates={candidates} selected={selected} onChange={setSelected} />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || importing}
            onClick={() => void importSelected()}
          >
            Import {selected.size > 0 ? selected.size : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
