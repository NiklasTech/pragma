"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { looksSecretEnvKey } from "@/shared/lib/mcpSecretEnv";

export interface SecretEnvEntry {
  key: string;
  value: string;
}

export interface McpEnvValue {
  envText: string;
  secrets: SecretEnvEntry[];
}

interface McpEnvFieldsProps {
  value: McpEnvValue;
  /** Secret names the saved server already has. */
  savedKeys: string[];
  /** Saved secret names without a value in the keychain. */
  missingKeys: string[];
  onChange: (value: McpEnvValue) => void;
}

export function parseEnv(text: string): Record<string, string> {
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

function secretPlaceholder(key: string, savedKeys: string[], missingKeys: string[]): string {
  if (missingKeys.includes(key)) return "Not set, enter a value";
  if (savedKeys.includes(key)) return "Stored in keychain, leave empty to keep";
  return "Value";
}

export function McpEnvFields({ value, savedKeys, missingKeys, onChange }: McpEnvFieldsProps) {
  const { envText, secrets } = value;
  const plainEnv = parseEnv(envText);
  const secretLikeKeys = Object.keys(plainEnv).filter(looksSecretEnvKey);

  const updateSecret = (index: number, patch: Partial<SecretEnvEntry>) =>
    onChange({
      envText,
      secrets: secrets.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });

  const moveToSecrets = () =>
    onChange({
      envText: envText
        .split("\n")
        .filter((line) => !secretLikeKeys.includes(line.split("=")[0]?.trim() ?? ""))
        .join("\n"),
      secrets: [
        ...secrets.filter((entry) => !secretLikeKeys.includes(entry.key)),
        ...secretLikeKeys.map((key) => ({ key, value: plainEnv[key] ?? "" })),
      ],
    });

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Environment (KEY=VALUE per line)</Label>
        <Textarea
          value={envText}
          onChange={(e) => onChange({ envText: e.target.value, secrets })}
          placeholder="NODE_ENV=production"
          className="min-h-20 font-mono"
        />
        {secretLikeKeys.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui-xs text-status-warning">
              {secretLikeKeys.join(", ")}{" "}
              {secretLikeKeys.length === 1 ? "looks like a secret" : "look like secrets"} and would
              be stored in plain text.
            </p>
            <Button size="xs" variant="outline" onClick={moveToSecrets} className="shrink-0">
              Move to Secrets
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Secrets (stored in the OS keychain)</Label>
          <Button
            size="xs"
            variant="outline"
            onClick={() => onChange({ envText, secrets: [...secrets, { key: "", value: "" }] })}
            className="gap-1"
          >
            <Plus size={12} />
            Add Secret
          </Button>
        </div>
        {secrets.length === 0 && (
          <p className="text-ui-xs text-fg-subtle">
            Tokens and API keys added here are never written to settings or exports.
          </p>
        )}
        {secrets.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={entry.key}
              onChange={(e) => updateSecret(index, { key: e.target.value })}
              placeholder="GITHUB_TOKEN"
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
              onClick={() => onChange({ envText, secrets: secrets.filter((_, i) => i !== index) })}
              title="Remove secret"
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
