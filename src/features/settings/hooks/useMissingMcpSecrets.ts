import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { McpServerConfig } from "@/shared/stores/settings";

type SecretQuery = [serverId: string, keys: string[]];

/** Secret env names per server that have no value in the keychain. */
export function useMissingMcpSecrets(servers: McpServerConfig[]) {
  const [missing, setMissing] = useState<Record<string, string[]>>({});
  const [revision, setRevision] = useState(0);
  const signature = JSON.stringify(
    servers
      .filter((server) => server.secretEnv.length > 0)
      .map((server): SecretQuery => [server.id, server.secretEnv]),
  );

  useEffect(() => {
    let active = true;
    const queries = JSON.parse(signature) as SecretQuery[];
    void Promise.all(
      queries.map(async ([serverId, keys]): Promise<SecretQuery> => {
        try {
          return [serverId, await invoke<string[]>("mcp_missing_secrets", { serverId, keys })];
        } catch {
          return [serverId, []];
        }
      }),
    ).then((results) => {
      if (active) setMissing(Object.fromEntries(results.filter(([, keys]) => keys.length > 0)));
    });
    return () => {
      active = false;
    };
  }, [signature, revision]);

  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  return { missing, refresh };
}
