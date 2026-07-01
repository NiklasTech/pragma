import { useMemo, useState } from "react";

import { useAIStore, type AIProvider } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAvailableModels } from "@/shared/hooks/useAvailableModels";
import { cn } from "@/shared/lib/utils";
import {
  LOCAL_PROVIDER,
  MODE_LABELS,
  PROVIDER_LABELS,
  PROVIDER_MODEL_MODES,
  type ProviderMode,
} from "@/shared/lib/ai-providers";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Brain, CaretDown, Check, House, Lightning, Robot } from "@phosphor-icons/react";

const MODE_ICONS: Record<ProviderMode, typeof Lightning> = {
  fast: Lightning,
  smart: Brain,
  local: House,
};

const MODE_ORDER: ProviderMode[] = ["fast", "smart", "local"];

const CLI_PROVIDER_IDS: Record<AIProvider, string[]> = {
  openai: [],
  anthropic: [],
  ollama: [],
  deepseek: [],
  kimi: ["moonshot-kimi"],
  gemini: [],
  openrouter: [],
  custom: [],
  copilot: [],
};

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

  const handleModeChange = (mode: ProviderMode) => {
    if (mode === "local") {
      const nextModel = providers[LOCAL_PROVIDER].model || "";
      setActiveProvider(LOCAL_PROVIDER);
      setActiveCLIProvider(null);
      setActiveModel(nextModel);
      updateProviderConfig(LOCAL_PROVIDER, { model: nextModel });
      settingsStore.setAISettings({
        defaultProvider: LOCAL_PROVIDER,
        defaultModel: nextModel,
      });
      return;
    }

    const targetModel = PROVIDER_MODEL_MODES[activeProvider][mode];
    if (!targetModel) return;
    setActiveModel(targetModel);
    updateProviderConfig(activeProvider, { model: targetModel });
    settingsStore.setAISettings({ defaultModel: targetModel });
  };

  const currentMode: ProviderMode | null = useMemo(() => {
    if (activeProvider === LOCAL_PROVIDER) return "local";
    const modes = PROVIDER_MODEL_MODES[activeProvider];
    if (activeModel === modes.fast) return "fast";
    if (activeModel === modes.smart) return "smart";
    return null;
  }, [activeProvider, activeModel]);

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
          <span className="truncate">{activeModel || "No model"}</span>
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
          {/* Mode quick switch */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-bg-hover p-1">
            {MODE_ORDER.map((mode) => {
              const Icon = MODE_ICONS[mode];
              const active = currentMode === mode;
              const disabled =
                mode === "local" ? false : !PROVIDER_MODEL_MODES[activeProvider][mode];

              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleModeChange(mode)}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-ui-xs font-medium transition-colors",
                    active
                      ? "bg-bg-surface text-fg-default shadow-sm"
                      : "text-fg-muted hover:text-fg-default",
                    disabled && "cursor-not-allowed opacity-40 hover:text-fg-muted",
                  )}
                >
                  <Icon size={12} />
                  {MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>

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
