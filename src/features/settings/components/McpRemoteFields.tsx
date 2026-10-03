"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

import type { SecretEnvEntry } from "./McpEnvFields";

export interface McpRemoteValue {
  url: string;
  headersText: string;
  secretHeaders: SecretEnvEntry[];
}

interface McpRemoteFieldsProps {
  value: McpRemoteValue;
  /** Secret header names the saved server already has. */
  savedKeys: string[];
  /** Saved secret header names without a value in the keychain. */
  missingKeys: string[];
  onChange: (value: McpRemoteValue) => void;
}

const SECRET_HEADER_PATTERN = /(authorization|token|secret|key|cookie)/i;

export function looksSecretHeader(name: string): boolean {
  return SECRET_HEADER_PATTERN.test(name);
}

/// `Name: value` per line; blank lines and `#` comments are skipped.
export function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const name = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (name) headers[name] = value;
  }
  return headers;
}

export function formatHeaders(headers: Record<string, string> | undefined): string {
  return Object.entries(headers ?? {})
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}

function secretPlaceholder(name: string, savedKeys: string[], missingKeys: string[]): string {
  if (missingKeys.includes(name)) return "Not set, enter a value";
  if (savedKeys.includes(name)) return "Stored in keychain, leave empty to keep";
  return "Value";
}

export function McpRemoteFields({ value, savedKeys, missingKeys, onChange }: McpRemoteFieldsProps) {
  const { url, headersText, secretHeaders } = value;
  const secretLike = Object.keys(parseHeaders(headersText)).filter(looksSecretHeader);

  const updateSecret = (index: number, patch: Partial<SecretEnvEntry>) =>
    onChange({
      ...value,
      secretHeaders: secretHeaders.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry,
      ),
    });

  const moveToSecrets = () => {
    const plain = parseHeaders(headersText);
    onChange({
      url,
      headersText: headersText
        .split("\n")
        .filter((line) => !secretLike.includes(line.split(":")[0]?.trim() ?? ""))
        .join("\n"),
      secretHeaders: [
        ...secretHeaders.filter((entry) => !secretLike.includes(entry.key)),
        ...secretLike.map((key) => ({ key, value: plain[key] ?? "" })),
      ],
    });
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>URL</Label>
        <Input
          value={url}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          placeholder="https://mcp.example.com/mcp"
          className="font-mono"
        />
        <p className="text-ui-xs text-fg-subtle">
          Streamable HTTP endpoint. Servers that use OAuth ask you to sign in after saving.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Headers (Name: value per line)</Label>
        <Textarea
          value={headersText}
          onChange={(e) => onChange({ ...value, headersText: e.target.value })}
          placeholder="X-Workspace: docs"
          className="min-h-16 font-mono"
        />
        {secretLike.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui-xs text-status-warning">
              {secretLike.join(", ")}{" "}
              {secretLike.length === 1 ? "looks like a secret" : "look like secrets"} and would be
              stored in plain text.
            </p>
            <Button size="xs" variant="outline" onClick={moveToSecrets} className="shrink-0">
              Move to Secrets
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Secret headers (stored in the OS keychain)</Label>
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              onChange({ ...value, secretHeaders: [...secretHeaders, { key: "", value: "" }] })
            }
            className="gap-1"
          >
            <Plus size={12} />
            Add Secret
          </Button>
        </div>
        {secretHeaders.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={entry.key}
              onChange={(e) => updateSecret(index, { key: e.target.value })}
              placeholder="Authorization"
              className="font-mono"
            />
            <Input
              type="password"
              autoComplete="off"
              value={entry.value}
              onChange={(e) => updateSecret(index, { value: e.target.value })}
              placeholder={secretPlaceholder(entry.key.trim(), savedKeys, missingKeys)}
              className="font-mono"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() =>
                onChange({ ...value, secretHeaders: secretHeaders.filter((_, i) => i !== index) })
              }
              title="Remove secret header"
              className="text-fg-muted hover:text-status-error"
            >
              <Trash size={14} />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
