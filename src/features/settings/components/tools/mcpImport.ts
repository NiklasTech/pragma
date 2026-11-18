import { invoke } from "@tauri-apps/api/core";

import { extractSecretLikeEnv } from "@/shared/lib/mcpSecretEnv";
import { useSettingsStore, type McpServerConfig } from "@/shared/stores/settings";

import { looksSecretHeader } from "../McpRemoteFields";
import type { McpImportCandidate } from "./cliMcp";

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

/// Adds the candidates to Pragma's servers, secrets in the keychain, and saves the config.
/// Resolves to the first error, if any; the servers that could be added stay added.
export async function importMcpCandidates(
  candidates: McpImportCandidate[],
): Promise<string | null> {
  const settings = useSettingsStore.getState();
  let error: string | null = null;
  for (const candidate of candidates) {
    const env = extractSecretLikeEnv(candidate.server);
    const headers = extractSecretHeaders(env.server);
    const id = settings.addMcpServer({ ...headers.server, autostart: false });
    try {
      await storeSecrets(id, env.values, "env");
      await storeSecrets(id, headers.values, "header");
    } catch (err) {
      error ??= `Could not store a secret of ${headers.server.name}: ${String(err)}`;
    }
  }
  try {
    await invoke("mcp_save_config", { servers: useSettingsStore.getState().mcp.servers });
  } catch (err) {
    error ??= String(err);
  }
  return error;
}
