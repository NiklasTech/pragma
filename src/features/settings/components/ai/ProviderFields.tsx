"use client";

import { CheckCircle, XCircle } from "@phosphor-icons/react";

import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { PROVIDER_LABELS, isCLIOnlyProvider } from "@/shared/lib/ai-providers";
import type { AIProvider } from "@/shared/stores/ai";

import { SettingRow } from "../ui/SettingRow";
import { ModelSelect } from "./ModelSelect";
import type { ConnectionTestStatus } from "./types";

interface ProviderFieldsProps {
  provider: AIProvider;
  model: string;
  baseUrl?: string;
  configured: boolean;
  testStatus: ConnectionTestStatus;
  showUnavailableProviders: boolean;
  onProviderChange: (provider: AIProvider) => void;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (baseUrl: string) => void;
  onShowUnavailableProvidersChange: (show: boolean) => void;
}

export function ProviderFields({
  provider,
  model,
  baseUrl,
  configured,
  testStatus,
  showUnavailableProviders,
  onProviderChange,
  onModelChange,
  onBaseUrlChange,
  onShowUnavailableProvidersChange,
}: ProviderFieldsProps) {
  return (
    <>
      <SettingRow
        label="Default Provider"
        description="AI provider used for chat and inline completion"
        control={
          <Select value={provider} onValueChange={(v) => onProviderChange(v as AIProvider)}>
            <SelectTrigger className="max-w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="flex items-center justify-between rounded-md border border-border/30 bg-bg-root px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${configured ? "bg-status-success" : "bg-fg-subtle"}`}
          />
          <span className="text-ui-sm text-fg-default">{PROVIDER_LABELS[provider]}</span>
          <span className="text-ui-xs text-fg-muted">
            {configured ? "Configured" : "Not configured"}
          </span>
        </div>
        {testStatus === "ok" && (
          <span className="flex items-center gap-1 text-ui-xs text-status-success">
            <CheckCircle size={14} /> Connected
          </span>
        )}
        {testStatus === "error" && (
          <span className="flex items-center gap-1 text-ui-xs text-status-error">
            <XCircle size={14} /> Failed
          </span>
        )}
      </div>

      <ModelSelect provider={provider} value={model} onChange={onModelChange} />

      <SettingRow
        label="Show unavailable providers"
        description="Display providers without a configured key in the chat model selector"
        control={
          <Switch
            checked={showUnavailableProviders}
            onCheckedChange={onShowUnavailableProvidersChange}
          />
        }
      />

      {(provider === "ollama" || provider === "custom") && (
        <SettingRow
          label="Base URL"
          description="Endpoint for OpenAI-compatible requests"
          control={
            <div className="flex max-w-[280px] flex-col gap-1">
              <Input
                value={baseUrl ?? ""}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder={
                  provider === "ollama" ? "http://localhost:11434" : "http://127.0.0.1:1234/v1"
                }
                className="max-w-[200px]"
              />
              {provider === "custom" && (
                <span className="text-ui-2xs text-fg-muted">
                  Include the API version path, e.g. <code className="text-fg-subtle">/v1</code>. LM
                  Studio and Ollama usually need{" "}
                  <code className="text-fg-subtle">http://localhost:PORT/v1</code>.
                </span>
              )}
            </div>
          }
        />
      )}

      {isCLIOnlyProvider(provider) && (
        <p className="text-ui-xs text-fg-muted">
          {PROVIDER_LABELS[provider]} is a local CLI and is configured from Local CLI Integration
          below.
        </p>
      )}
    </>
  );
}
