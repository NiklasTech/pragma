"use client";

import { PROVIDER_LABELS } from "@/shared/lib/ai-providers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAIStore } from "@/shared/stores/ai";

import type { AgentEngine } from "./types";

const BUILTIN_VALUE = "builtin";

export function engineLabel(engine: AgentEngine, cliName?: string | null): string {
  if (engine.kind === "cli") return cliName ?? engine.cliProviderId ?? "CLI";
  const provider = engine.provider ? PROVIDER_LABELS[engine.provider] : "Built-in";
  return engine.model ? `${provider} / ${engine.model}` : provider;
}

interface AgentEnginePickerProps {
  value: AgentEngine;
  onChange: (engine: AgentEngine) => void;
}

export function AgentEnginePicker({ value, onChange }: AgentEnginePickerProps) {
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const providers = useAIStore((state) => state.providers);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const cliStatuses = useAIStore((state) => state.cliStatuses);

  const chatClis = cliManifests.filter(
    (manifest) => manifest.uses_acp && cliStatuses[manifest.id]?.installed === true,
  );
  const selected = value.kind === "cli" ? (value.cliProviderId ?? "") : BUILTIN_VALUE;

  const builtinEngine = (): AgentEngine => {
    const engine: AgentEngine = { kind: "builtin", provider: activeProvider, model: activeModel };
    const baseUrl = providers[activeProvider].baseUrl;
    if (baseUrl) engine.baseUrl = baseUrl;
    return engine;
  };

  return (
    <Select
      value={selected}
      onValueChange={(next) => {
        const id = String(next);
        if (id === BUILTIN_VALUE) {
          onChange(builtinEngine());
          return;
        }
        onChange({ kind: "cli", cliProviderId: id });
      }}
    >
      <SelectTrigger className="h-8 w-full max-w-[280px]">
        <SelectValue>{engineLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BUILTIN_VALUE}>
          {`Built-in - ${PROVIDER_LABELS[activeProvider]} / ${activeModel || "No model"}`}
        </SelectItem>
        {chatClis.map((manifest) => (
          <SelectItem key={manifest.id} value={manifest.id}>
            {manifest.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
