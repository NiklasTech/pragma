"use client";

import { useShallow } from "zustand/react/shallow";
import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/shared/components/ui/button";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore, type McpServerConfig } from "@/shared/stores/settings";
import { DownloadSimple, Plus } from "@phosphor-icons/react";
import { SettingSection } from "./ui/SettingSection";
import { useMcpServers } from "../hooks/useMcpServers";
import { McpServerLogSheet } from "./McpServerLogSheet";
import { McpImportDialog } from "./McpImportDialog";
import { useMissingMcpSecrets } from "../hooks/useMissingMcpSecrets";
import { formToServerData, serverToForm, type EditForm } from "./mcp-server-form";
import { McpServerForm } from "./McpServerForm";
import { MCP_ROW_GRID, McpServerRow } from "./McpServerRow";
import { mcpUsage, visibleClis } from "./tools/cliMcp";
import { McpEmptyImport } from "./tools/McpEmptyImport";
import { useCliMcpServers } from "./tools/useCliMcpServers";
import { useMcpShare } from "./tools/useMcpShare";

function serversEqual(a: McpServerConfig[], b: McpServerConfig[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function McpSettings() {
  const { mcp, addMcpServer, updateMcpServer, removeMcpServer, setMcpSettings } = useSettingsStore(
    useShallow((s) => ({
      mcp: s.mcp,
      addMcpServer: s.addMcpServer,
      updateMcpServer: s.updateMcpServer,
      removeMcpServer: s.removeMcpServer,
      setMcpSettings: s.setMcpSettings,
    })),
  );
  const {
    statuses,
    tools,
    logs,
    authRequired,
    errors,
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
  const [importOpen, setImportOpen] = React.useState(false);
  const { missing: missingSecrets, refresh: refreshMissingSecrets } = useMissingMcpSecrets(
    mcp.servers,
  );
  const cli = useCliMcpServers();
  const refreshCli = cli.refresh;
  const { share, dialog: shareDialog } = useMcpShare(
    React.useCallback(() => void refreshCli(), [refreshCli]),
  );
  const cliStatuses = useAIStore((state) => state.cliStatuses);
  const usage = React.useMemo(() => mcpUsage(cli.candidates), [cli.candidates]);
  const clis = React.useMemo(() => {
    const installed = new Set(
      Object.values(cliStatuses)
        .filter((status) => status.installed)
        .map((status) => status.provider_id),
    );
    return visibleClis(installed, usage);
  }, [cliStatuses, usage]);

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
    const { serverData, remote, pendingSecrets } = formToServerData(form);

    if (!serverData.name || (remote ? !serverData.url : !serverData.command)) return;

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
    for (const { key, value, kind } of pendingSecrets) {
      if (!value) continue;
      try {
        await invoke("mcp_set_secret", { serverId: id, key, value, kind });
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
    <div className="flex flex-col gap-2">
      <SettingSection
        title="MCP servers"
        badge={mcp.servers.length > 0 ? { label: String(mcp.servers.length) } : undefined}
        action={
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                void cli.refresh();
                setImportOpen(true);
              }}
              disabled={editingId !== null}
              className="gap-1"
            >
              <DownloadSimple size={12} />
              Import
            </Button>
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
          </div>
        }
      >
        {(loading || statusLoading) && <p className="py-3 text-ui-xs text-fg-muted">Loading...</p>}

        {editingId !== null && (
          <McpServerForm
            form={form}
            setForm={setForm}
            savedServer={mcp.servers.find((s) => s.id === editingId)}
            missingKeys={editingId ? (missingSecrets[editingId] ?? []) : []}
            saveError={saveError}
            onCancel={handleCancel}
            onSave={() => void handleSave()}
          />
        )}

        {mcp.servers.length === 0 && !editingId && (
          <McpEmptyImport
            candidates={cli.candidates}
            loaded={cli.loaded}
            onImported={() => {
              void loadConfig();
              void load();
              refreshMissingSecrets();
            }}
          />
        )}

        {mcp.servers.length > 0 && (
          <div className={`${MCP_ROW_GRID} pb-1 font-mono text-[10px] text-fg-subtle`}>
            <span />
            <span>server</span>
            <span>state</span>
            <span className="text-right">tools</span>
            <span>{clis.length > 0 ? "used by" : ""}</span>
            <span />
          </div>
        )}

        <div className="flex flex-col">
          {mcp.servers.map((server) => (
            <McpServerRow
              key={server.id}
              server={server}
              status={statuses[server.id] ?? "stopped"}
              tools={tools[server.id] ?? []}
              logs={logs[server.id] ?? []}
              authRequired={authRequired[server.id] ?? false}
              error={errors[server.id]}
              missingSecrets={missingSecrets[server.id]}
              usage={usage[server.name] ?? {}}
              clis={clis}
              onStart={() => startServer(server.id)}
              onStop={() => stopServer(server.id)}
              onRestart={() => restartServer(server.id)}
              onShowLogs={() => setLogServerId(server.id)}
              onEdit={() => handleEdit(server)}
              onDelete={() => handleDelete(server.id)}
              onShare={(target) => share(server, target)}
            />
          ))}
        </div>
      </SettingSection>

      {shareDialog}

      <McpImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        candidates={cli.candidates}
        loaded={cli.loaded}
        onImported={() => {
          void loadConfig();
          void load();
          refreshMissingSecrets();
        }}
      />

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
