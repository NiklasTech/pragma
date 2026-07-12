import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAIStore, type AIProvider } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAvailableModels } from "@/shared/hooks/useAvailableModels";
import { PROVIDER_LABELS, isKeyOptionalProvider } from "@/shared/lib/ai-providers";
import { Eye, EyeSlash } from "@phosphor-icons/react";

const ONBOARDING_PROVIDERS: AIProvider[] = [
  "anthropic",
  "openai",
  "deepseek",
  "kimi",
  "gemini",
  "ollama",
  "custom",
];

interface AISetupStepProps {
  onSkipStep: () => void;
}

export function AISetupStep({ onSkipStep }: AISetupStepProps) {
  const aiStore = useAIStore();
  const settingsStore = useSettingsStore();

  const activeProvider = settingsStore.ai.defaultProvider;
  const providerConfig = settingsStore.ai.providers[activeProvider];
  const {
    models: availableModels,
    loading: modelsLoading,
    needsKey: modelSelectNeedsKey,
  } = useAvailableModels(activeProvider);

  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    ONBOARDING_PROVIDERS.filter((p) => !isKeyOptionalProvider(p)).forEach(
      (p) => void aiStore.loadKeyStatus(p),
    );
  }, [aiStore]);

  const handleProviderChange = (provider: AIProvider) => {
    const nextModel =
      settingsStore.ai.providers[provider]?.model || aiStore.providers[provider]?.model || "";
    if (!settingsStore.ai.providers[provider]) {
      settingsStore.updateProvider(provider, { model: nextModel });
    }
    settingsStore.setAISettings({ defaultProvider: provider, defaultModel: nextModel });
    aiStore.setActiveProvider(provider);
    aiStore.setActiveModel(nextModel);
    setKeyInput("");
  };

  const handleModelChange = (model: string) => {
    settingsStore.updateProvider(activeProvider, { model });
    settingsStore.setAISettings({ defaultModel: model });
    aiStore.setActiveModel(model);
  };

  const handleBaseUrlChange = (baseUrl: string) => {
    settingsStore.updateProvider(activeProvider, { baseUrl });
    aiStore.updateProviderConfig(activeProvider, { baseUrl });
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    await aiStore.storeApiKey(activeProvider, keyInput.trim());
    setKeyInput("");
  };

  const needsKey = !isKeyOptionalProvider(activeProvider);
  const apiKeyRef = aiStore.apiKeyRefs[activeProvider];

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2 text-center">
        <h2 className="text-ui-lg font-semibold text-fg-default">Set up AI (optional)</h2>
        <p className="text-ui-sm text-fg-muted">
          Choose a provider and enter an API key to enable inline completions and chat.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select
            value={activeProvider}
            onValueChange={(v) => handleProviderChange(v as AIProvider)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ONBOARDING_PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {PROVIDER_LABELS[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(activeProvider === "ollama" || activeProvider === "custom") && (
          <div className="space-y-1.5">
            <Label>Base URL</Label>
            <Input
              value={providerConfig.baseUrl ?? ""}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder={
                activeProvider === "ollama" ? "http://localhost:11434" : "http://127.0.0.1:1234/v1"
              }
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Model</Label>
          <Select
            value={providerConfig.model}
            onValueChange={(v) => handleModelChange(v ?? "")}
            disabled={modelsLoading || modelSelectNeedsKey}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={modelSelectNeedsKey ? "Save an API key first" : "Select a model"}
              />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
              {providerConfig.model &&
                !availableModels.some((m) => m.id === providerConfig.model) && (
                  <SelectItem value={providerConfig.model}>{providerConfig.model}</SelectItem>
                )}
            </SelectContent>
          </Select>
          {modelsLoading && <p className="text-ui-xs text-fg-muted">Loading models…</p>}
          {modelSelectNeedsKey && (
            <p className="text-ui-xs text-fg-muted">Save an API key to load models</p>
          )}
        </div>

        {needsKey && (
          <div className="space-y-1.5">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={apiKeyRef ? "Key saved — enter new to replace" : "sk-..."}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.92] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:text-fg-default"
                  tabIndex={-1}
                >
                  {showKey ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button
                variant="outline"
                onClick={handleSaveKey}
                disabled={!keyInput.trim()}
                className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Save
              </Button>
            </div>
            {apiKeyRef && <p className="text-ui-xs text-status-success">Saved key: {apiKeyRef}</p>}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSkipStep}
        className="self-center text-ui-sm text-fg-muted underline-offset-4 transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:text-fg-default hover:underline"
      >
        Skip AI setup
      </button>
    </div>
  );
}
