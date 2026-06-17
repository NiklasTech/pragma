"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { useSettingsStore, type McpServerConfig } from "@/shared/stores/settings";
import { Plus, PencilSimple, Trash, FloppyDisk, X } from "@phosphor-icons/react";

interface EditForm {
  name: string;
  command: string;
  argsText: string;
  envText: string;
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
    autostart: server?.autostart ?? false,
  };
}

function parseArgs(text: string): string[] {
  return text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) env[key] = value;
  }
  return env;
}

export function McpSettings() {
  const { mcp, addMcpServer, updateMcpServer, removeMcpServer, setMcpSettings } =
    useSettingsStore();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<EditForm>(serverToForm());
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    invoke<McpServerConfig[]>("mcp_load_config")
      .then((servers) => {
        if (servers.length > 0 && mcp.servers.length === 0) {
          setMcpSettings({ servers });
        }
      })
      .catch((err) => console.error("[MCP Load]", err))
      .finally(() => setLoading(false));
  }, [mcp.servers.length, setMcpSettings]);

  const persist = async (servers: McpServerConfig[]) => {
    try {
      await invoke("mcp_save_config", { servers });
    } catch (err) {
      console.error("[MCP Save]", err);
    }
  };

  const handleAdd = () => {
    setEditingId("new");
    setForm(serverToForm());
  };

  const handleEdit = (server: McpServerConfig) => {
    setEditingId(server.id);
    setForm(serverToForm(server));
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(serverToForm());
  };

  const handleSave = () => {
    const serverData = {
      name: form.name.trim(),
      command: form.command.trim(),
      args: parseArgs(form.argsText),
      env: parseEnv(form.envText),
      autostart: form.autostart,
    };

    if (!serverData.name || !serverData.command) return;

    if (editingId === "new") {
      addMcpServer(serverData);
    } else if (editingId) {
      updateMcpServer(editingId, serverData);
    } else {
      return;
    }

    void persist(useSettingsStore.getState().mcp.servers);
    setEditingId(null);
    setForm(serverToForm());
  };

  const handleDelete = (id: string) => {
    removeMcpServer(id);
    void persist(useSettingsStore.getState().mcp.servers.filter((s) => s.id !== id));
  };

  const handleAutostartToggle = (server: McpServerConfig, value: boolean) => {
    updateMcpServer(server.id, { autostart: value });
    void persist(useSettingsStore.getState().mcp.servers);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Model Context Protocol Servers</CardTitle>
          <Button size="xs" onClick={handleAdd} disabled={editingId !== null} className="gap-1">
            <Plus size={14} />
            Add Server
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading && <p className="text-ui-xs text-fg-muted">Loading configuration...</p>}

          {editingId !== null && (
            <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-bg-root p-3">
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
                  placeholder="e.g. npx"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Arguments (one per line or whitespace separated)</Label>
                <Textarea
                  value={form.argsText}
                  onChange={(e) => setForm((f) => ({ ...f, argsText: e.target.value }))}
                  placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/home/user"
                  className="min-h-20 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Environment (KEY=VALUE per line)</Label>
                <Textarea
                  value={form.envText}
                  onChange={(e) => setForm((f) => ({ ...f, envText: e.target.value }))}
                  placeholder="GITHUB_TOKEN=..."
                  className="min-h-20 font-mono"
                />
              </div>

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

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="xs" onClick={handleCancel}>
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
                <Button size="xs" onClick={handleSave}>
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

          <div className="flex flex-col gap-2">
            {mcp.servers.map((server) => (
              <div
                key={server.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-bg-root p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-ui-sm font-medium text-fg-default">{server.name}</span>
                    <span className="rounded-full bg-bg-hover px-1.5 py-0.5 text-ui-xs text-fg-subtle">
                      {server.autostart ? "autostart" : "manual"}
                    </span>
                  </div>
                  <code className="truncate text-ui-xs text-fg-muted">
                    {server.command} {server.args.join(" ")}
                  </code>
                  {Object.keys(server.env).length > 0 && (
                    <span className="text-ui-xs text-fg-subtle">
                      {Object.keys(server.env).length} env variable
                      {Object.keys(server.env).length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5 pr-2">
                    <Label className="cursor-pointer text-ui-xs" htmlFor={`autostart-${server.id}`}>
                      Autostart
                    </Label>
                    <Switch
                      id={`autostart-${server.id}`}
                      checked={server.autostart}
                      onCheckedChange={(v) => handleAutostartToggle(server, v)}
                    />
                  </div>
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
