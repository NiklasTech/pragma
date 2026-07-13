import { useEffect, useMemo, useState } from "react";

import { useAIStore, type AIProvider } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAvailableModels } from "@/shared/hooks/useAvailableModels";
import { cn } from "@/shared/lib/utils";
import { CLI_PROVIDER_IDS, PROVIDER_LABELS } from "@/shared/lib/ai-providers";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Input } from "@/shared/components/ui/input";
import { CaretDown, Check, Robot, Warning } from "@phosphor-icons/react";

export type AiModelSelectorVariant = "default" | "pill" | "icon";

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

export function AiModelSelector({ variant = "default" }: { variant?: AiModelSelectorVariant }) {
  const [open, setOpen] = useState(false);
  const [customModel, setCustomModel] = useState("");
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
  const showUnavailable = settingsStore.ai.showUnavailableProviders;

  const {
    models: availableModels,
    loading: modelsLoading,
    error: modelsError,
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
  }, [apiKeyRefs, activeCLIProvider, cliStatuses, copilotAuth.authenticated, providers]);

  const visibleProviders = useMemo(() => {
    const all = Object.keys(PROVIDER_LABELS) as AIProvider[];
    const filtered = showUnavailable ? all : all.filter((p) => availableMap[p]);
    // Always keep the active provider selectable, even when hidden.
    if (!filtered.includes(activeProvider)) {
      return [...filtered, activeProvider].sort((a, b) =>
        PROVIDER_LABELS[a].localeCompare(PROVIDER_LABELS[b]),
      );
    }
    return filtered;
  }, [availableMap, showUnavailable, activeProvider]);

  const isAvailable = availableMap[activeProvider];

  const cliAuthenticated = isCLIAuthenticated(
    CLI_PROVIDER_IDS[activeProvider],
    activeCLIProvider,
    cliStatuses,
  );
  const modelLabel = activeModel || (cliAuthenticated ? "CLI" : "No model");
  const tooltipLabel = `${PROVIDER_LABELS[activeProvider]} / ${modelLabel}`;

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

  // Keep the custom input in sync with the active model.
  useEffect(() => {
    setCustomModel(activeModel ?? "");
  }, [activeModel, open]);

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

  const handleCustomModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customModel.trim();
    if (!trimmed) return;
    handleModelChange(trimmed);
    setOpen(false);
  };

  const showCustomInput = activeProvider === "custom" && availableModels.length === 0;

  const statusDot = (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        isAvailable ? "bg-status-success" : "bg-status-error",
      )}
      title={isAvailable ? "Online" : "Offline"}
    />
  );

  const trigger = (
    <span
      className={cn(
        "inline-flex items-center transition-colors",
        variant === "icon" &&
          "size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-bg-root text-fg-muted hover:bg-bg-hover hover:text-fg-default",
        variant === "pill" &&
          "h-6 max-w-[140px] cursor-pointer gap-1.5 rounded-full border border-border/60 bg-bg-root px-2 text-ui-xs font-medium text-fg-muted hover:bg-bg-hover hover:text-fg-default",
        variant === "default" &&
          "h-7 max-w-[220px] cursor-pointer gap-1.5 rounded-md border border-border/60 bg-bg-root px-2 text-ui-sm font-medium hover:bg-bg-hover",
        !isAvailable && "text-fg-muted",
      )}
    >
      {variant !== "icon" && <Robot size={variant === "pill" ? 11 : 13} className="shrink-0" />}
      {variant === "icon" && <Robot size={14} className="shrink-0" />}

      {variant !== "icon" && (
        <span className={cn("min-w-0 truncate", variant === "pill" && "max-w-[80px]")}>
          {variant === "pill" ? (
            <>
              <span className="text-fg-default">{PROVIDER_LABELS[activeProvider]}</span>
              <span className="text-fg-subtle"> / {modelLabel}</span>
            </>
          ) : (
            <>
              {PROVIDER_LABELS[activeProvider]}
              <span className="text-fg-muted"> / </span>
              {modelLabel}
            </>
          )}
        </span>
      )}

      {statusDot}

      {variant !== "icon" && (
        <CaretDown size={variant === "pill" ? 10 : 12} className="shrink-0 text-fg-subtle" />
      )}
    </span>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <span title={variant === "icon" ? tooltipLabel : undefined}>{trigger}</span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="flex w-60 flex-col overflow-hidden p-0"
      >
        {/* Active summary */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-bg-root px-3 py-2">
          <Robot size={14} className="text-fg-muted" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-ui-xs font-medium text-fg-default">
              {PROVIDER_LABELS[activeProvider]}
            </span>
            <span className="truncate text-ui-2xs text-fg-subtle">{modelLabel}</span>
          </div>
          <span
            className={cn(
              "ml-auto size-1.5 rounded-full",
              isAvailable ? "bg-status-success" : "bg-status-error",
            )}
          />
        </div>

        {/* Providers */}
        <div className="flex max-h-[180px] flex-col overflow-y-auto p-1.5">
          <span className="px-2 py-1 text-ui-2xs font-semibold uppercase tracking-wider text-fg-muted">
            Provider
          </span>
          <div className="flex flex-col gap-0.5">
            {visibleProviders.map((provider) => {
              const isActive = provider === activeProvider;
              const available = availableMap[provider];
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => handleProviderChange(provider)}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-ui-xs transition-colors",
                    isActive
                      ? "bg-bg-active/50 font-medium text-fg-default"
                      : "text-fg-default/90 hover:bg-bg-hover",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {isActive ? (
                      <Check size={11} className="shrink-0 text-primary" weight="bold" />
                    ) : (
                      <span className="w-2.5 shrink-0" />
                    )}
                    {PROVIDER_LABELS[provider]}
                  </span>
                  <span
                    className={cn(
                      "size-1 rounded-full",
                      available ? "bg-status-success" : "bg-status-error",
                    )}
                    title={available ? "Online" : "Offline"}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Models */}
        <div className="flex max-h-[200px] flex-col overflow-y-auto border-t border-border/60 p-1.5">
          <span className="px-2 py-1 text-ui-2xs font-semibold uppercase tracking-wider text-fg-muted">
            Model
          </span>
          {modelsLoading ? (
            <span className="block px-2 py-1 text-ui-2xs text-fg-muted">Loading models…</span>
          ) : modelSelectNeedsKey ? (
            <span className="block px-2 py-1 text-ui-2xs text-fg-muted">
              Save an API key to load models
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              {availableModels.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {availableModels.map((model) => {
                    const isActive = model.id === activeModel;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleModelChange(model.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-xs transition-colors",
                          isActive
                            ? "bg-bg-active/50 font-medium text-fg-default"
                            : "text-fg-default/90 hover:bg-bg-hover",
                        )}
                      >
                        {isActive ? (
                          <Check size={11} className="shrink-0 text-primary" weight="bold" />
                        ) : (
                          <span className="w-2.5 shrink-0" />
                        )}
                        <span className="truncate">{model.name}</span>
                      </button>
                    );
                  })}
                  {activeModel && !availableModels.some((m) => m.id === activeModel) && (
                    <button
                      type="button"
                      onClick={() => handleModelChange(activeModel)}
                      className="flex items-center gap-2 rounded-md bg-bg-active/50 px-2 py-1.5 text-left text-ui-xs font-medium text-fg-default"
                    >
                      <Check size={11} className="shrink-0 text-primary" weight="bold" />
                      <span className="truncate">{activeModel}</span>
                    </button>
                  )}
                </div>
              )}

              {showCustomInput && (
                <form onSubmit={handleCustomModelSubmit} className="flex flex-col gap-1.5 px-2">
                  <label htmlFor="ai-custom-model" className="text-ui-2xs text-fg-muted">
                    Enter model name manually
                  </label>
                  <Input
                    id="ai-custom-model"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. lmstudio-community/Meta-Llama-3-8B"
                    className="h-7 text-ui-xs"
                  />
                  <button
                    type="submit"
                    disabled={!customModel.trim()}
                    className="self-start rounded-md bg-primary px-2 py-1 text-ui-2xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Use model
                  </button>
                </form>
              )}

              {!showCustomInput && availableModels.length === 0 && (
                <span className="block px-2 py-1 text-ui-2xs text-fg-muted">
                  No models available
                </span>
              )}

              {modelsError && !modelsLoading && (
                <div className="flex items-start gap-1.5 rounded-md bg-status-error/10 px-2 py-1.5 text-ui-2xs text-status-error">
                  <Warning size={12} className="mt-0.5 shrink-0" />
                  <span className="break-words">{modelsError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {!isAvailable && (
          <div className="border-t border-border/60 px-3 py-2">
            <p className="text-ui-2xs text-status-error">
              Provider not available. Add an API key in Settings or connect a CLI subscription.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
