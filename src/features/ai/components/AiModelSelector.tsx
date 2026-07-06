import { useEffect, useMemo, useState } from "react";

import { useAIStore, type AIProvider } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAvailableModels } from "@/shared/hooks/useAvailableModels";
import { cn } from "@/shared/lib/utils";
import { CLI_PROVIDER_IDS, PROVIDER_LABELS } from "@/shared/lib/ai-providers";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { CaretDown, Check, Robot } from "@phosphor-icons/react";

function isCLIAuthenticated(
  ids: string[],
  activeCLIProvider: string | null,
  cliStatuses: Record<string, { authenticated?: boolean }>,
): boolean {
  if (!activeCLIProvider) return false;
  if (!ids.includes(activeCLIProvider)) return false;
  return cliStatuses[activeCLIProvider]?.authenticated ?? false;
}

function isProviderAvailable(
  provider: AIProvider,
  config: { baseUrl?: string; model: string },
  apiKeyRefs: Record<AIProvider, string | null>,
  activeCLIProvider: string | null,
  cliStatuses: Record<string, { authenticated?: boolean }>,
  copilotAuthenticated: boolean,
): boolean {
  if (provider === "ollama") return true;
  if (provider === "custom") return Boolean(config.baseUrl) && config.model.length > 0;
  if (provider === "copilot") return copilotAuthenticated;
  if (apiKeyRefs[provider] !== null) return true;
  return isCLIAuthenticated(CLI_PROVIDER_IDS[provider], activeCLIProvider, cliStatuses);
}

export function AiModelSelector() {
  const [open, setOpen] = useState(false);
  const {
    activeProvider,
    activeModel,
    providers,
    apiKeyRefs,
    activeCLIProvider,
    cliStatuses,
    copilotAuth,
    setActiveProvider,
    setActiveModel,
    setActiveCLIProvider,
    updateProviderConfig,
  } = useAIStore();
  const settingsStore = useSettingsStore();

  const {
    models: availableModels,
    loading: modelsLoading,
    needsKey: modelSelectNeedsKey,
  } = useAvailableModels(activeProvider);

  const availableMap = useMemo(() => {
    const map: Record<AIProvider, boolean> = {
      openai: false,
      anthropic: false,
      ollama: false,
      deepseek: false,
      kimi: false,
      gemini: false,
      openrouter: false,
      custom: false,
      copilot: false,
    };
    (Object.keys(map) as AIProvider[]).forEach((p) => {
      map[p] = isProviderAvailable(
        p,
        providers[p],
        apiKeyRefs,
        activeCLIProvider,
        cliStatuses,
        copilotAuth.authenticated,
      );
    });
    return map;
  }, [apiKeyRefs, activeCLIProvider, cliStatuses, copilotAuth.authenticated]);

  const isAvailable = availableMap[activeProvider];

  const cliAuthenticated = isCLIAuthenticated(
    CLI_PROVIDER_IDS[activeProvider],
    activeCLIProvider,
    cliStatuses,
  );
  const modelLabel = activeModel || (cliAuthenticated ? "CLI" : "No model");

  // Auto-select the first fetched model when none is set.
  useEffect(() => {
    if (activeModel) return;
    if (!availableModels.length) return;
    const first = availableModels[0].id;
    if (!first) return;
    setActiveModel(first);
    updateProviderConfig(activeProvider, { model: first });
    settingsStore.setAISettings({ defaultModel: first });
  }, [
    activeModel,
    availableModels,
    activeProvider,
    setActiveModel,
    updateProviderConfig,
    settingsStore,
  ]);

  const handleProviderChange = (provider: AIProvider) => {
    setActiveProvider(provider);
    setActiveCLIProvider(null);
    const nextModel = providers[provider].model || "";
    setActiveModel(nextModel);
    updateProviderConfig(provider, { model: nextModel });
    settingsStore.setAISettings({ defaultProvider: provider, defaultModel: nextModel });
  };

  const handleModelChange = (model: string | null) => {
    if (!model) return;
    setActiveModel(model);
    updateProviderConfig(activeProvider, { model });
    settingsStore.setAISettings({ defaultModel: model });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <span
          className={cn(
            "inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-md border border-border/60 bg-bg-root px-2 text-ui-sm font-medium transition-colors hover:bg-bg-hover",
            !isAvailable && "text-fg-muted",
          )}
        >
          <Robot size={13} className="shrink-0 text-fg-muted" />
          <span className="truncate">{PROVIDER_LABELS[activeProvider]}</span>
          <span className="text-fg-muted">/</span>
          <span className="truncate">{modelLabel}</span>
          <span
            className={cn(
              "ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
              isAvailable ? "bg-status-success" : "bg-status-error",
            )}
            title={isAvailable ? "Online" : "Offline"}
          />
          <CaretDown size={12} className="shrink-0 text-fg-muted" />
        </span>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" className="w-72 p-3">
        <div className="flex flex-col gap-3">
          {/* Provider list */}
          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-medium uppercase tracking-wider text-fg-muted">
              Provider
            </span>
            <div className="flex flex-col gap-0.5">
              {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((provider) => {
                const isActive = provider === activeProvider;
                const available = availableMap[provider];
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleProviderChange(provider)}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2 py-1.5 text-ui-sm transition-colors",
                      isActive
                        ? "bg-bg-active/50 font-medium text-fg-default"
                        : "text-fg-default/90 hover:bg-bg-hover",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {isActive && (
                        <Check size={12} className="shrink-0 text-primary" weight="bold" />
                      )}
                      {!isActive && <span className="w-3 shrink-0" />}
                      {PROVIDER_LABELS[provider]}
                    </span>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        available ? "bg-status-success" : "bg-status-error",
                      )}
                      title={available ? "Online" : "Offline"}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model select */}
          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-medium uppercase tracking-wider text-fg-muted">
              Model
            </span>
            <Select
              value={activeModel}
              onValueChange={handleModelChange}
              disabled={modelsLoading || modelSelectNeedsKey}
            >
              <SelectTrigger className="h-8 text-ui-sm">
                <SelectValue
                  placeholder={modelSelectNeedsKey ? "Save an API key first" : "Select model"}
                />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-ui-sm">
                    {model.name}
                  </SelectItem>
                ))}
                {activeModel && !availableModels.some((m) => m.id === activeModel) && (
                  <SelectItem value={activeModel} className="text-ui-sm">
                    {activeModel}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {modelsLoading && <span className="text-ui-xs text-fg-muted">Loading models…</span>}
            {modelSelectNeedsKey && (
              <span className="text-ui-xs text-fg-muted">Save an API key to load models</span>
            )}
          </div>

          {/* Configure hint */}
          {!isAvailable && (
            <p className="text-ui-xs text-status-error">
              Provider not available. Add an API key in Settings or connect a CLI subscription.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
