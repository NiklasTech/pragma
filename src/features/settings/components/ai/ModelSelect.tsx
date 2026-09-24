"use client";

import * as React from "react";

import { useAvailableModels } from "@/shared/hooks/useAvailableModels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { AIProvider } from "@/shared/stores/ai";

const UNREACHABLE_MESSAGES = [
  "connection refused",
  "connection failed",
  "failed to fetch",
  "network error",
  "error sending request",
];

function formatModelError(error: string): string {
  const normalized = error.toLowerCase();
  if (UNREACHABLE_MESSAGES.some((pattern) => normalized.includes(pattern))) {
    return "Local model server is not running";
  }
  const withoutUrl = error
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const message = withoutUrl.replace(/[:\s]+$/, "") || "Could not load models";
  return message.length > 100 ? `${message.slice(0, 97)}...` : message;
}

interface ModelSelectProps {
  provider: AIProvider;
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelect({ provider, value, onChange }: ModelSelectProps) {
  const { models, loading, error, needsKey } = useAvailableModels(provider);

  const options = React.useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const m of models) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({ id: m.id, name: m.name });
      }
    }
    if (value && !seen.has(value)) {
      list.push({ id: value, name: value });
    }
    return list;
  }, [models, value]);

  const disabled = loading || needsKey;
  const placeholder = needsKey ? "Save an API key first" : "Select a model";

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={value} onValueChange={(v) => onChange(v ?? "")} disabled={disabled}>
        <SelectTrigger className="max-w-[280px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && <span className="text-ui-xs text-fg-muted">Loading models…</span>}
      {needsKey && <span className="text-ui-xs text-fg-muted">Save an API key to load models</span>}
      {error && !loading && (
        <span className="text-ui-xs text-status-error">{formatModelError(error)}</span>
      )}
    </div>
  );
}
