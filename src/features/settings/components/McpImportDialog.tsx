"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { extractSecretLikeEnv } from "@/shared/lib/mcpSecretEnv";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore, type McpServerConfig } from "@/shared/stores/settings";

import { looksSecretHeader } from "./McpRemoteFields";

interface McpImportCandidate {
  source: string;
  server: McpServerConfig;
}

interface McpImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

function describe(server: McpServerConfig): string {
  return server.transport === "http"
    ? (server.url ?? "")
    : [server.command, ...server.args].join(" ");
}

/// Splits secret-looking headers out of the plain headers and returns their values.
function extractSecretHeaders(server: McpServerConfig): {
  server: McpServerConfig;
  values: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(server.headers ?? {})) {
    if (looksSecretHeader(name)) {
      values[name] = value;
    } else {
      headers[name] = value;
    }
  }
  return { server: { ...server, headers, secretHeaders: Object.keys(values) }, values };
}

async function storeSecrets(
  serverId: string,
  values: Record<string, string>,
  kind: "env" | "header",
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    await invoke("mcp_set_secret", { serverId, key, value, kind });
  }
}

/// Imports servers from the workspace `.mcp.json` and the Claude Desktop configuration.
export function McpImportDialog({ open, onOpenChange, onImported }: McpImportDialogProps) {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const [candidates, setCandidates] = React.useState<McpImportCandidate[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void invoke<McpImportCandidate[]>("mcp_import_candidates", { workspaceRoot: rootPath })
      .then((found) => {
        if (!active) return;
        const existing = new Set(useSettingsStore.getState().mcp.servers.map((s) => s.name));
        setCandidates(found);
        setSelected(
          new Set(
            found.flatMap((candidate, index) =>
              existing.has(candidate.server.name) ? [] : [index],
            ),
          ),
        );
      })
      .catch((err: unknown) => toast.error(String(err)))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, rootPath]);

  const toggle = (index: number, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });

  const importSelected = async () => {
    setImporting(true);
    const settings = useSettingsStore.getState();
    let error: string | null = null;
    for (const index of selected) {
      const candidate = candidates[index];
      if (!candidate) continue;
      const env = extractSecretLikeEnv(candidate.server);
      const headers = extractSecretHeaders(env.server);
      const id = settings.addMcpServer({ ...headers.server, autostart: false });
      try {
        await storeSecrets(id, env.values, "env");
        await storeSecrets(id, headers.values, "header");
      } catch (err) {
        error = `Could not store a secret of ${headers.server.name}: ${String(err)}`;
      }
    }
    try {
      await invoke("mcp_save_config", { servers: useSettingsStore.getState().mcp.servers });
    } catch (err) {
      error = String(err);
    }
    setImporting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(`Imported ${selected.size} MCP ${selected.size === 1 ? "server" : "servers"}`);
    }
    onImported();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import MCP servers</DialogTitle>
          <DialogDescription>
            From the workspace .mcp.json and the Claude Desktop configuration. Secrets go to the OS
            keychain.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-ui-xs text-fg-muted">Looking for servers...</p>}
        {!loading && candidates.length === 0 && (
          <p className="text-ui-xs text-fg-muted">No servers found to import.</p>
        )}
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {candidates.map((candidate, index) => (
            <label
              key={`${candidate.source}:${candidate.server.name}`}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 select-none hover:bg-bg-hover"
            >
              <Checkbox
                className="mt-0.5"
                checked={selected.has(index)}
                onCheckedChange={(checked) => toggle(index, checked)}
              />
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-ui-sm text-fg-default">
                  {candidate.server.name}
                  <span className="text-ui-xs text-fg-subtle">{candidate.source}</span>
                </span>
                <code className="truncate text-ui-xs text-fg-muted">
                  {describe(candidate.server)}
                </code>
              </span>
            </label>
          ))}
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
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
