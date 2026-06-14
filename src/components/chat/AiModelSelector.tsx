import { useMemo, useState } from "react";

import { useAIStore, type AIProvider } from "@/stores/ai";
import { cn } from "@/lib/utils";
import {
  LOCAL_PROVIDER,
  MODE_LABELS,
  PROVIDER_LABELS,
  PROVIDER_MODEL_MODES,
  PROVIDER_MODELS,
  type ProviderMode,
} from "@/lib/ai-providers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, CaretDown, Check, House, Lightning, Robot } from "@phosphor-icons/react";

const MODE_ICONS: Record<ProviderMode, typeof Lightning> = {
  fast: Lightning,
  smart: Brain,
  local: House,
};

const MODE_ORDER: ProviderMode[] = ["fast", "smart", "local"];

const CLI_PROVIDER_IDS: Record<AIProvider, string[]> = {
  openai: ["openai-codex"],
  anthropic: ["anthropic-claude"],
  ollama: [],
  deepseek: [],
  kimi: ["moonshot-kimi"],
  custom: [],
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
  apiKeyRefs: Record<AIProvider, string | null>,
  activeCLIProvider: string | null,
  cliStatuses: Record<string, { authenticated?: boolean }>,
): boolean {
  if (provider === "ollama") return true;
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
    setActiveProvider,
    setActiveModel,
    updateProviderConfig,
  } = useAIStore();

  const activeConfig = providers[activeProvider];

  const availableMap = useMemo(() => {
    const map: Record<AIProvider, boolean> = {
      openai: false,
      anthropic: false,
      ollama: false,
      deepseek: false,
      kimi: false,
      custom: false,
    };
    (Object.keys(map) as AIProvider[]).forEach((p) => {
      map[p] = isProviderAvailable(p, apiKeyRefs, activeCLIProvider, cliStatuses);
    });
    return map;
  }, [apiKeyRefs, activeCLIProvider, cliStatuses]);

  const isAvailable = availableMap[activeProvider];

  const handleProviderChange = (provider: AIProvider) => {
    setActiveProvider(provider);
    const models = PROVIDER_MODELS[provider];
    const fallback = providers[provider].model;
    const nextModel = models[0] ?? fallback ?? "";
    setActiveModel(nextModel);
    updateProviderConfig(provider, { model: nextModel });
  };

  const handleModelChange = (model: string | null) => {
    if (!model) return;
    setActiveModel(model);
    updateProviderConfig(activeProvider, { model });
  };

  const handleModeChange = (mode: ProviderMode) => {
    if (mode === "local") {
      const models = PROVIDER_MODELS[LOCAL_PROVIDER];
      const fallback = providers[LOCAL_PROVIDER].model;
      const nextModel = models[0] ?? fallback ?? "";
      setActiveProvider(LOCAL_PROVIDER);
      setActiveModel(nextModel);
      updateProviderConfig(LOCAL_PROVIDER, { model: nextModel });
      return;
    }

    const targetModel = PROVIDER_MODEL_MODES[activeProvider][mode];
    if (!targetModel) return;
    setActiveModel(targetModel);
    updateProviderConfig(activeProvider, { model: targetModel });
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
            "inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 text-[12px] font-medium transition-colors hover:bg-accent",
            !isAvailable && "text-muted-foreground",
          )}
        >
          <Robot size={13} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{PROVIDER_LABELS[activeProvider]}</span>
          <span className="text-muted-foreground">/</span>
          <span className="truncate">{activeModel || "No model"}</span>
          <span
            className={cn(
              "ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
              isAvailable ? "bg-green-500" : "bg-destructive",
            )}
            title={isAvailable ? "Online" : "Offline"}
          />
          <CaretDown size={12} className="shrink-0 text-muted-foreground" />
        </span>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" className="w-72 p-3">
        <div className="flex flex-col gap-3">
          {/* Mode quick switch */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
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
                    "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
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
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                      "flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] transition-colors",
                      isActive
                        ? "bg-accent/50 font-medium text-foreground"
                        : "text-foreground/90 hover:bg-accent/30",
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
                        available ? "bg-green-500" : "bg-destructive",
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
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Model
            </span>
            <Select value={activeModel} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_MODELS[activeProvider].map((model) => (
                  <SelectItem key={model} value={model} className="text-[12px]">
                    {model}
                  </SelectItem>
                ))}
                {activeProvider === "custom" && activeConfig.model && (
                  <SelectItem value={activeConfig.model} className="text-[12px]">
                    {activeConfig.model}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Configure hint */}
          {!isAvailable && (
            <p className="text-[11px] text-destructive">
              Provider not available. Add an API key in Settings or connect a CLI subscription.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
