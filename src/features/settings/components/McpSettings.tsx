"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { useSettingsStore, type McpServerConfig } from "@/shared/stores/settings";
import {
  Plus,
  PencilSimple,
  Trash,
  FloppyDisk,
  X,
  Play,
  Stop,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { SettingSection } from "./ui/SettingSection";
import { useMcpServers, type McpServerStatus } from "../hooks/useMcpServers";
import { McpServerLogSheet, LogButton } from "./McpServerLogSheet";
import { McpServerTools } from "./McpServerTools";
import { McpEnvFields, parseEnv, type SecretEnvEntry } from "./McpEnvFields";
import { useMissingMcpSecrets } from "../hooks/useMissingMcpSecrets";

interface EditForm {
  name: string;
  command: string;
  argsText: string;
  envText: string;
  secrets: SecretEnvEntry[];
  autostart: boolean;
}

function serverToForm(server?: McpServerConfig): EditForm {
  return {
    name: server?.name ?? "",
    command: server?.command ?? "",
    argsText: server?.args.join("\n") ?? "",
    envText: server
      ? Object.entries(server.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : "",
    secrets: server?.secretEnv.map((key) => ({ key, value: "" })) ?? [],
    autostart: server?.autostart ?? false,
  };
}

function parseArgs(text: string): string[] {
  const raw = text.includes("\n") ? text.split("\n") : text.split(/\s+/);
  return raw
    .map((s) => {
      let trimmed = s.trim();
      // Allow copy-pasted JSON-style values like: "-y",
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        trimmed = trimmed.slice(1, -1);
      }
      if (trimmed.endsWith(",")) {
        trimmed = trimmed.slice(0, -1);
      }
      return trimmed.trim();
    })
    .filter(Boolean);
}

function statusColor(status: McpServerStatus): string {
  switch (status) {
    case "running":
      return "bg-status-success";
    case "starting":
      return "bg-status-warning";
    case "error":
      return "bg-status-error";
    case "stopped":
    default:
      return "bg-fg-subtle";
  }
}

function statusLabel(status: McpServerStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "starting":
      return "Starting";
    case "error":
      return "Error";
    case "stopped":
    default:
      return "Stopped";
  }
}

function serversEqual(a: McpServerConfig[], b: McpServerConfig[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function McpSettings() {
  const { mcp, addMcpServer, updateMcpServer, removeMcpServer, setMcpSettings } =
    useSettingsStore();
  const {
    statuses,
    tools,
    logs,
    loading: statusLoading,
    load,
    startServer,
    stopServer,
    restartServer,
    clearLogs,
  } = useMcpServers();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<EditForm>(serverToForm());
  const [loading, setLoading] = React.useState(false);
  const [logServerId, setLogServerId] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const { missing: missingSecrets, refresh: refreshMissingSecrets } = useMissingMcpSecrets(
    mcp.servers,
  );

  const loadConfig = React.useCallback(async () => {
    // Don't overwrite the form while the user is editing.
    if (editingId !== null) return;
    try {
      const servers = await invoke<McpServerConfig[]>("mcp_load_config");
      const current = useSettingsStore.getState().mcp.servers;
      if (!serversEqual(servers, current)) {
        setMcpSettings({ servers });
      }
    } catch {}
  }, [editingId, setMcpSettings]);

  React.useEffect(() => {
    setLoading(true);
    void loadConfig().finally(() => setLoading(false));

    const interval = setInterval(() => void loadConfig(), 5000);
    const handleFocus = () => void loadConfig();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadConfig]);

  const persist = async (servers: McpServerConfig[]) => {
    try {
      await invoke("mcp_save_config", { servers });
      await load();
    } catch {}
  };

  const handleAdd = () => {
    setEditingId("new");
    setForm(serverToForm());
    setSaveError(null);
  };

  const handleEdit = (server: McpServerConfig) => {
    setEditingId(server.id);
    setForm(serverToForm(server));
    setSaveError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(serverToForm());
    setSaveError(null);
  };

  const handleSave = async () => {
    const secrets = form.secrets
      .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
      .filter((entry) => entry.key);
    const secretEnv = [...new Set(secrets.map((entry) => entry.key))];
    const env = parseEnv(form.envText);
    for (const key of secretEnv) delete env[key];

    const serverData = {
      name: form.name.trim(),
      command: form.command.trim(),
      args: parseArgs(form.argsText),
      env,
      secretEnv,
      autostart: form.autostart,
    };

    if (!serverData.name || !serverData.command) return;

    let id: string;
    if (editingId === "new") {
      id = addMcpServer(serverData);
    } else if (editingId) {
      id = editingId;
      updateMcpServer(editingId, serverData);
    } else {
      return;
    }

    // Secrets go to the keychain before the config, which may autostart the server.
    let error: string | null = null;
    for (const { key, value } of secrets) {
      if (!value) continue;
      try {
        await invoke("mcp_set_secret", { serverId: id, key, value });
      } catch (e) {
        error = `Could not store ${key} in the keychain: ${String(e)}`;
      }
    }

    await persist(useSettingsStore.getState().mcp.servers);
    refreshMissingSecrets();

    if (error) {
      setEditingId(id);
      setSaveError(error);
      return;
    }
    setEditingId(null);
    setForm(serverToForm());
    setSaveError(null);
  };

  const handleDelete = (id: string) => {
    removeMcpServer(id);
    void persist(useSettingsStore.getState().mcp.servers.filter((s) => s.id !== id));
  };

  const activeLogServer = logServerId
    ? (mcp.servers.find((s) => s.id === logServerId) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <SettingSection
        title="Servers"
        action={
          <Button
            size="xs"
            variant="outline"
            onClick={handleAdd}
            disabled={editingId !== null}
            className="gap-1"
          >
            <Plus size={12} />
            Add Server
          </Button>
        }
      >
        {(loading || statusLoading) && <p className="py-3 text-ui-xs text-fg-muted">Loading...</p>}

        {editingId !== null && (
          <div className="flex flex-col gap-3 py-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. filesystem"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Command</Label>
              <Input
                value={form.command}
                onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                placeholder="e.g. npm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Arguments (one per line or whitespace separated)</Label>
              <Textarea
                value={form.argsText}
                onChange={(e) => setForm((f) => ({ ...f, argsText: e.target.value }))}
                placeholder="exec&#10;--yes&#10;@modelcontextprotocol/server-filesystem&#10;/home/user"
                className="min-h-20 font-mono"
              />
            </div>

            <McpEnvFields
              value={{ envText: form.envText, secrets: form.secrets }}
              savedKeys={mcp.servers.find((s) => s.id === editingId)?.secretEnv ?? []}
              missingKeys={editingId ? (missingSecrets[editingId] ?? []) : []}
              onChange={(env) => setForm((f) => ({ ...f, ...env }))}
            />

            <div className="flex items-center justify-between">
              <Label className="cursor-pointer" htmlFor="mcp-autostart">
                Autostart
              </Label>
              <Switch
                id="mcp-autostart"
                checked={form.autostart}
                onCheckedChange={(v) => setForm((f) => ({ ...f, autostart: v }))}
              />
            </div>

            {saveError && <p className="text-ui-xs text-status-error">{saveError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="xs" onClick={handleCancel}>
                <X size={14} className="mr-1" />
                Cancel
              </Button>
              <Button size="xs" onClick={() => void handleSave()}>
                <FloppyDisk size={14} className="mr-1" />
                Save
              </Button>
            </div>
          </div>
        )}

        {mcp.servers.length === 0 && !editingId && (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center">
            <p className="text-ui-sm text-fg-muted">No MCP servers configured.</p>
            <p className="text-ui-xs text-fg-subtle">
              Add a server to make MCP tools available to the AI chat.
            </p>
          </div>
        )}

        <div className="flex flex-col">
          {mcp.servers.map((server) => {
            const status = statuses[server.id] ?? "stopped";
            const isRunning = status === "running" || status === "starting";
            return (
              <div
                key={server.id}
                className="flex items-center justify-between gap-3 border-b border-border/30 py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", statusColor(status))}
                    title={statusLabel(status)}
                  />
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-ui-sm font-medium text-fg-default">{server.name}</span>
                      <span className="text-ui-xs text-fg-subtle">{statusLabel(status)}</span>
                      {server.autostart && (
                        <span className="rounded-full border border-border/30 px-1.5 py-0.5 text-ui-xs text-fg-muted">
                          autostart
                        </span>
                      )}
                      {missingSecrets[server.id] && (
                        <span
                          className="rounded-full border border-status-warning/40 px-1.5 py-0.5 text-ui-xs text-status-warning"
                          title={`Edit the server to enter ${missingSecrets[server.id]?.join(", ")}`}
                        >
                          missing secrets
                        </span>
                      )}
                    </div>
                    <code className="truncate text-ui-xs text-fg-muted">
                      {server.command} {server.args.join(" ")}
                    </code>
                    <McpServerTools tools={tools[server.id] ?? []} />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => (isRunning ? stopServer(server.id) : startServer(server.id))}
                    title={isRunning ? "Stop server" : "Start server"}
                    disabled={status === "starting"}
                  >
                    {isRunning ? <Stop size={14} /> : <Play size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => restartServer(server.id)}
                    title="Restart server"
                    disabled={status === "starting"}
                  >
                    <ArrowClockwise size={14} />
                  </Button>
                  <LogButton
                    onClick={() => setLogServerId(server.id)}
                    logCount={(logs[server.id] ?? []).length}
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleEdit(server)}
                    title="Edit server"
                  >
                    <PencilSimple size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(server.id)}
                    title="Delete server"
                    className="text-fg-muted hover:text-status-error"
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SettingSection>

      {activeLogServer && (
        <McpServerLogSheet
          serverId={activeLogServer.id}
          serverName={activeLogServer.name}
          logs={logs[activeLogServer.id] ?? []}
          open={logServerId !== null}
          onOpenChange={(open) => {
            if (!open) setLogServerId(null);
          }}
          onClear={clearLogs}
        />
      )}
    </div>
  );
}
