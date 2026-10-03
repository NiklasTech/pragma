import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { McpServerConfig } from "@/shared/stores/settings";

type SecretKind = "env" | "header";
type SecretQuery = [serverId: string, keys: string[], kind: SecretKind];

/** Secret env and header names per server that have no value in the keychain. */
export function useMissingMcpSecrets(servers: McpServerConfig[]) {
  const [missing, setMissing] = useState<Record<string, string[]>>({});
  const [revision, setRevision] = useState(0);
  const signature = JSON.stringify(
    servers.flatMap((server): SecretQuery[] => [
      ...(server.secretEnv.length > 0 ? [[server.id, server.secretEnv, "env"] as SecretQuery] : []),
      ...(server.secretHeaders?.length
        ? [[server.id, server.secretHeaders, "header"] as SecretQuery]
        : []),
    ]),
  );

  useEffect(() => {
    let active = true;
    const queries = JSON.parse(signature) as SecretQuery[];
    void Promise.all(
      queries.map(async ([serverId, keys, kind]): Promise<SecretQuery> => {
        try {
          return [
            serverId,
            await invoke<string[]>("mcp_missing_secrets", { serverId, keys, kind }),
            kind,
          ];
        } catch {
          return [serverId, [], kind];
        }
      }),
    ).then((results) => {
      if (!active) return;
      const merged: Record<string, string[]> = {};
      for (const [serverId, keys] of results) {
        if (keys.length > 0) merged[serverId] = [...(merged[serverId] ?? []), ...keys];
      }
      setMissing(merged);
    });
    return () => {
      active = false;
    };
  }, [signature, revision]);

  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  return { missing, refresh };
}
