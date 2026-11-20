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
import {
  accountLabel,
  choosableAccounts,
  useCliAccountsStore,
} from "@/shared/stores/ai/cliAccounts";
import { useSettingsStore } from "@/shared/stores/settings";

import type { AgentEngine } from "./types";

const BUILTIN_VALUE = "builtin";
const ACCOUNT_SEPARATOR = "::";

interface EngineChoice {
  value: string;
  label: string;
  engine: AgentEngine;
}

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
  const accounts = useCliAccountsStore((state) => state.accounts);
  const accountNames = useSettingsStore((state) => state.ai.cliAccounts.names);

  const chatClis = cliManifests.filter(
    (manifest) => manifest.uses_acp && cliStatuses[manifest.id]?.installed === true,
  );
  // A chat CLI with several accounts is offered once per account.
  const choices = chatClis.flatMap((manifest): EngineChoice[] => {
    const several = choosableAccounts(accounts, manifest.id);
    if (several.length === 0) {
      return [
        {
          value: manifest.id,
          label: manifest.name,
          engine: { kind: "cli", cliProviderId: manifest.id },
        },
      ];
    }
    return several.map((account) => ({
      value: `${manifest.id}${ACCOUNT_SEPARATOR}${account.configDir ?? ""}`,
      label: `${manifest.name} · ${accountLabel(account, accountNames)}`,
      engine: account.configDir
        ? { kind: "cli", cliProviderId: manifest.id, cliAccountDir: account.configDir }
        : { kind: "cli", cliProviderId: manifest.id },
    }));
  });
  const selectedChoice = choices.find(
    (choice) =>
      value.kind === "cli" &&
      choice.engine.cliProviderId === value.cliProviderId &&
      (choice.engine.cliAccountDir ?? null) === (value.cliAccountDir ?? null),
  );
  const selected =
    value.kind === "cli" ? (selectedChoice?.value ?? value.cliProviderId ?? "") : BUILTIN_VALUE;

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
        const choice = choices.find((item) => item.value === id);
        onChange(choice ? choice.engine : { kind: "cli", cliProviderId: id });
      }}
    >
      <SelectTrigger className="h-8 w-full max-w-[280px]">
        <SelectValue>{selectedChoice?.label ?? engineLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BUILTIN_VALUE}>
          {`Built-in - ${PROVIDER_LABELS[activeProvider]} / ${activeModel || "No model"}`}
        </SelectItem>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
