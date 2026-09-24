"use client";

import * as React from "react";

import { invoke } from "@tauri-apps/api/core";

import {
  CLI_PROVIDER_IDS,
  PROVIDER_LABELS,
  isCLIOnlyProvider,
  isKeyOptionalProvider,
  supportsApiKey,
} from "@/shared/lib/ai-providers";
import { useAIStore, type AIProvider } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { SettingSection } from "./ui/SettingSection";
import { ApiKeyRow } from "./ai/ApiKeyRow";
import { CliIntegrationSection } from "./ai/CliIntegrationSection";
import { CopilotBlock } from "./ai/CopilotBlock";
import { InlineCompletionSection } from "./ai/InlineCompletionSection";
import { ProviderFields } from "./ai/ProviderFields";
import { TestConnection } from "./ai/TestConnection";
import type { ApiKeySaveStatus, ConnectionTestStatus } from "./ai/types";
import { ChatContextSettings } from "./ChatContextSettings";
import { ProjectRulesSettings } from "./ProjectRulesSettings";
import { VoiceSettings } from "./VoiceSettings";

function isProviderConfigured(
  provider: AIProvider,
  config: { baseUrl?: string; model: string },
  apiKeyRef: string | null,
  copilotAuthenticated: boolean,
  cliStatuses: Record<string, { authenticated?: boolean }>,
): boolean {
  if (isCLIOnlyProvider(provider)) {
    return CLI_PROVIDER_IDS[provider].some((id) => cliStatuses[id]?.authenticated ?? false);
  }
  if (provider === "copilot") return copilotAuthenticated;
  if (provider === "ollama") return Boolean(config.baseUrl);
  if (provider === "custom") return Boolean(config.baseUrl) && config.model.length > 0;
  return Boolean(apiKeyRef);
}

export function AISettings() {
  const aiStore = useAIStore();
  const settingsStore = useSettingsStore();

  const [keyInput, setKeyInput] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<ConnectionTestStatus>("idle");
  const [testError, setTestError] = React.useState<string | null>(null);
  const [keySaveStatus, setKeySaveStatus] = React.useState<ApiKeySaveStatus | null>(null);

  const [copilotClientIdInput, setCopilotClientIdInput] = React.useState("");
  const [copilotUserCode, setCopilotUserCode] = React.useState<string | null>(null);
  const [copilotVerificationUri, setCopilotVerificationUri] = React.useState<string | null>(null);
  const [copilotPolling, setCopilotPolling] = React.useState(false);
  const [copilotError, setCopilotError] = React.useState<string | null>(null);

  const activeProvider = settingsStore.ai.defaultProvider;
  const providerConfig = settingsStore.ai.providers[activeProvider];
  const apiKeyRef = aiStore.apiKeyRefs[activeProvider];

  React.useEffect(() => {
    (Object.keys(PROVIDER_LABELS) as AIProvider[])
      .filter((p) => supportsApiKey(p))
      .forEach((p) => void aiStore.loadKeyStatus(p));
    void aiStore.loadCLIManifests();
    void aiStore.loadCLIStatuses();
    void aiStore.loadCopilotAuthStatus();
    setCopilotClientIdInput(aiStore.copilotAuth.clientId);
  }, []);

  const handleProviderChange = (provider: AIProvider) => {
    const nextModel =
      settingsStore.ai.providers[provider]?.model || aiStore.providers[provider]?.model || "";
    if (!settingsStore.ai.providers[provider]) {
      settingsStore.updateProvider(provider, { model: nextModel });
    }
    settingsStore.setAISettings({ defaultProvider: provider, defaultModel: nextModel });
    aiStore.setActiveProvider(provider);
    if (isCLIOnlyProvider(provider)) {
      const cliProviderId =
        CLI_PROVIDER_IDS[provider].find((id) => aiStore.cliStatuses[id]?.authenticated) ?? null;
      aiStore.setActiveCLIProvider(cliProviderId);
    } else {
      aiStore.setActiveCLIProvider(null);
    }
    aiStore.setActiveModel(nextModel);
    aiStore.updateProviderConfig(provider, { model: nextModel });
    setKeyInput("");
    setKeySaveStatus(null);
    setTestStatus("idle");
    setTestError(null);
    setCopilotError(null);
    setCopilotUserCode(null);
    setCopilotVerificationUri(null);
  };

  const handleModelChange = (model: string) => {
    settingsStore.updateProvider(activeProvider, { model });
    settingsStore.setAISettings({ defaultModel: model });
    aiStore.setActiveModel(model);
    aiStore.updateProviderConfig(activeProvider, { model });
  };

  const handleBaseUrlChange = (baseUrl: string) => {
    settingsStore.updateProvider(activeProvider, { baseUrl });
    aiStore.updateProviderConfig(activeProvider, { baseUrl });
    if (baseUrl.trim()) {
      void aiStore.loadAvailableModels(activeProvider, true);
    }
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setKeySaveStatus(null);
    try {
      await aiStore.storeApiKey(activeProvider, keyInput.trim());
      setKeyInput("");
      setKeySaveStatus({ type: "ok", message: "API key saved" });
      setTimeout(() => setKeySaveStatus(null), 3000);
    } catch (err) {
      setKeySaveStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save API key",
      });
    }
  };

  const handleDeleteKey = async () => {
    await aiStore.deleteApiKey(activeProvider);
    setKeyInput("");
  };

  const handleTest = async () => {
    setTestStatus("loading");
    setTestError(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>("ai_test_connection", {
        req: {
          provider: activeProvider,
          model: providerConfig.model,
          base_url: providerConfig.baseUrl,
          messages: [{ role: "user", content: "hi" }],
        },
      });
      if (result.ok) {
        setTestStatus("ok");
      } else {
        setTestStatus("error");
        setTestError(result.error ?? "Connection failed");
      }
    } catch (err) {
      setTestStatus("error");
      setTestError(String(err));
    }
  };

  const configured = isProviderConfigured(
    activeProvider,
    providerConfig,
    apiKeyRef,
    aiStore.copilotAuth.authenticated,
    aiStore.cliStatuses,
  );

  return (
    <div className="flex flex-col gap-8">
      <SettingSection title="Provider">
        <ProviderFields
          provider={activeProvider}
          model={providerConfig.model}
          baseUrl={providerConfig.baseUrl}
          configured={configured}
          testStatus={testStatus}
          showUnavailableProviders={settingsStore.ai.showUnavailableProviders}
          onProviderChange={handleProviderChange}
          onModelChange={handleModelChange}
          onBaseUrlChange={handleBaseUrlChange}
          onShowUnavailableProvidersChange={(v) => settingsStore.setShowUnavailableProviders(v)}
        />

        {supportsApiKey(activeProvider) && (
          <ApiKeyRow
            label={isKeyOptionalProvider(activeProvider) ? "API Key (optional)" : "API Key"}
            description={
              isKeyOptionalProvider(activeProvider)
                ? "Only needed if your local server requires one. Stored securely in the system keychain"
                : "Stored securely in the system keychain"
            }
            apiKeyRef={apiKeyRef}
            value={keyInput}
            showKey={showKey}
            saveStatus={keySaveStatus}
            onValueChange={setKeyInput}
            onToggleShowKey={() => setShowKey((s) => !s)}
            onSave={handleSaveKey}
            onDelete={handleDeleteKey}
          />
        )}

        {activeProvider === "copilot" && (
          <CopilotBlock
            clientIdInput={copilotClientIdInput}
            authenticated={aiStore.copilotAuth.authenticated}
            polling={copilotPolling}
            error={copilotError}
            userCode={copilotUserCode}
            verificationUri={copilotVerificationUri}
            onClientIdInputChange={setCopilotClientIdInput}
            onUserCodeChange={setCopilotUserCode}
            onVerificationUriChange={setCopilotVerificationUri}
            onPollingChange={setCopilotPolling}
            onErrorChange={setCopilotError}
          />
        )}

        {!isCLIOnlyProvider(activeProvider) && (
          <TestConnection
            testStatus={testStatus}
            testError={testError}
            configured={configured}
            onTest={handleTest}
          />
        )}
      </SettingSection>

      <CliIntegrationSection />

      <InlineCompletionSection
        enabled={settingsStore.ai.inlineCompletion}
        debounce={settingsStore.ai.completionDebounce}
        onEnabledChange={(v) => settingsStore.setAISettings({ inlineCompletion: v })}
        onDebounceChange={(v) => settingsStore.setAISettings({ completionDebounce: v })}
      />

      <ChatContextSettings />

      <ProjectRulesSettings />

      <VoiceSettings />
    </div>
  );
}
