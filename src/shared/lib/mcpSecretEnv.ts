import type { McpServerConfig } from "@/shared/stores/settings/types";

const SECRET_KEY_SUFFIXES = ["_TOKEN", "_KEY", "_SECRET"];

/** Server config as written by versions before secret env support. */
export type StoredMcpServerConfig = Omit<McpServerConfig, "secretEnv"> & { secretEnv?: string[] };

export function looksSecretEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  return SECRET_KEY_SUFFIXES.some((suffix) => upper.endsWith(suffix));
}

/** Drops the values of secret keys from `env`, so only the key names remain. */
export function withoutSecretValues(server: StoredMcpServerConfig): McpServerConfig {
  const secretEnv = [...new Set(server.secretEnv ?? [])];
  const env = Object.fromEntries(
    Object.entries(server.env).filter(([key]) => !secretEnv.includes(key)),
  );
  return { ...server, env, secretEnv };
}

/** Marks plain entries that look like secrets as secret and hands back their values. */
export function extractSecretLikeEnv(server: StoredMcpServerConfig): {
  server: McpServerConfig;
  values: Record<string, string>;
} {
  const values: Record<string, string> = {};
  const secretEnv = [...(server.secretEnv ?? [])];
  for (const [key, value] of Object.entries(server.env)) {
    if (!looksSecretEnvKey(key) || secretEnv.includes(key)) continue;
    secretEnv.push(key);
    if (value) values[key] = value;
  }
  return { server: withoutSecretValues({ ...server, secretEnv }), values };
}
