import { useSettingsStore, type McpServerConfig } from "@/shared/stores/settings";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  extractSecretLikeEnv,
  withoutSecretValues,
  type StoredMcpServerConfig,
} from "@/shared/lib/mcpSecretEnv";

type SettingsSnapshot = Partial<ReturnType<typeof useSettingsStore.getState>>;

export async function exportSettings(): Promise<void> {
  const state = useSettingsStore.getState();
  const payload = JSON.stringify(
    {
      editor: state.editor,
      terminal: state.terminal,
      ai: state.ai,
      theme: state.theme,
      themeMode: state.themeMode,
      keymap: state.keymap,
      shortcuts: state.shortcuts,
      layout: state.layout,
      statusbar: state.statusbar,
      workspace: state.workspace,
      mcp: { ...state.mcp, servers: state.mcp.servers.map(withoutSecretValues) },
      lsp: state.lsp,
      experimental: state.experimental,
      customThemes: state.customThemes,
    },
    null,
    2,
  );

  const path = await save({
    defaultPath: "pragma-settings.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!path) return;

  await invoke("write_text_file", { path, content: payload });
}

export async function importSettings(): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!selected || Array.isArray(selected)) return;

  const result = await invoke<{ content: string }>("read_text_file", { path: selected });
  const content = result.content;
  const parsed = JSON.parse(content) as unknown;

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid settings file");
  }

  const settings = parsed as SettingsSnapshot;
  const importedServers = settings.mcp?.servers;
  if (!importedServers) {
    useSettingsStore.getState().importSettings(settings);
    return;
  }

  const servers = await Promise.all(importedServers.map(storeLegacySecrets));
  useSettingsStore.getState().importSettings({ ...settings, mcp: { ...settings.mcp, servers } });
  await invoke("mcp_save_config", { servers });

  const missing = await missingSecretNames(servers);
  if (missing.length > 0) {
    toast.warning(`Enter the MCP secrets ${missing.join(", ")} in Settings > MCP.`);
  }
}

/** Older exports carried secret values in plain text; move them to the keychain. */
async function storeLegacySecrets(stored: StoredMcpServerConfig): Promise<McpServerConfig> {
  const { server, values } = extractSecretLikeEnv(stored);
  for (const [key, value] of Object.entries(values)) {
    try {
      await invoke("mcp_set_secret", { serverId: server.id, key, value });
    } catch {}
  }
  return server;
}

async function missingSecretNames(servers: McpServerConfig[]): Promise<string[]> {
  const missing = await Promise.all(
    servers
      .filter((server) => server.secretEnv.length > 0)
      .map((server) =>
        invoke<string[]>("mcp_missing_secrets", {
          serverId: server.id,
          keys: server.secretEnv,
        }).catch(() => server.secretEnv),
      ),
  );
  return [...new Set(missing.flat())];
}
