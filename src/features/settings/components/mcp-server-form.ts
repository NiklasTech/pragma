import type { McpServerConfig, McpTransport } from "@/shared/stores/settings";
import { parseEnv, type SecretEnvEntry } from "./McpEnvFields";
import { formatHeaders, parseHeaders } from "./McpRemoteFields";

export interface EditForm {
  name: string;
  transport: McpTransport;
  url: string;
  headersText: string;
  secretHeaders: SecretEnvEntry[];
  command: string;
  argsText: string;
  envText: string;
  secrets: SecretEnvEntry[];
  autostart: boolean;
}

export function serverToForm(server?: McpServerConfig): EditForm {
  return {
    name: server?.name ?? "",
    transport: server?.transport ?? "stdio",
    url: server?.url ?? "",
    headersText: formatHeaders(server?.headers),
    secretHeaders: server?.secretHeaders?.map((key) => ({ key, value: "" })) ?? [],
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

// Splits the form into the stored server config and the secrets that go to the keychain.
export function formToServerData(form: EditForm) {
  const secrets = form.secrets
    .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
    .filter((entry) => entry.key);
  const secretEnv = [...new Set(secrets.map((entry) => entry.key))];
  const env = parseEnv(form.envText);
  for (const key of secretEnv) delete env[key];

  const headerSecrets = form.secretHeaders
    .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
    .filter((entry) => entry.key);
  const secretHeaders = [...new Set(headerSecrets.map((entry) => entry.key))];
  const headers = parseHeaders(form.headersText);
  for (const key of secretHeaders) delete headers[key];
  const remote = form.transport === "http";

  const serverData = {
    name: form.name.trim(),
    transport: form.transport,
    command: remote ? "" : form.command.trim(),
    args: remote ? [] : parseArgs(form.argsText),
    env: remote ? {} : env,
    secretEnv: remote ? [] : secretEnv,
    url: remote ? form.url.trim() : undefined,
    headers: remote ? headers : {},
    secretHeaders: remote ? secretHeaders : [],
    autostart: form.autostart,
  };

  const pendingSecrets = remote
    ? headerSecrets.map((entry) => ({ ...entry, kind: "header" }))
    : secrets.map((entry) => ({ ...entry, kind: "env" }));

  return { serverData, remote, pendingSecrets };
}
