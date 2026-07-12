"use client";

import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useAIStore, type AIProvider } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAvailableModels } from "@/shared/hooks/useAvailableModels";
import { invoke } from "@tauri-apps/api/core";
import { PROVIDER_LABELS, isKeyOptionalProvider } from "@/shared/lib/ai-providers";
import {
  Eye,
  EyeSlash,
  FloppyDisk,
  Trash,
  CheckCircle,
  XCircle,
  DownloadSimple,
  SignIn,
  SignOut,
  Robot,
} from "@phosphor-icons/react";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";

function isProviderConfigured(
  provider: AIProvider,
  config: { baseUrl?: string; model: string },
  apiKeyRef: string | null,
  copilotAuthenticated: boolean,
): boolean {
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
  const [testStatus, setTestStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testError, setTestError] = React.useState<string | null>(null);
  const [keySaveStatus, setKeySaveStatus] = React.useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);
  const [installing, setInstalling] = React.useState<string | null>(null);
  const [loggingIn, setLoggingIn] = React.useState<string | null>(null);

  const [copilotClientIdInput, setCopilotClientIdInput] = React.useState("");
  const [copilotUserCode, setCopilotUserCode] = React.useState<string | null>(null);
  const [copilotVerificationUri, setCopilotVerificationUri] = React.useState<string | null>(null);
  const [copilotPolling, setCopilotPolling] = React.useState(false);
  const [copilotError, setCopilotError] = React.useState<string | null>(null);

  const activeProvider = settingsStore.ai.defaultProvider;
  const providerConfig = settingsStore.ai.providers[activeProvider];
  const apiKeyRef = aiStore.apiKeyRefs[activeProvider];
  const needsKey = !isKeyOptionalProvider(activeProvider);

  React.useEffect(() => {
    (Object.keys(PROVIDER_LABELS) as AIProvider[])
      .filter((p) => !isKeyOptionalProvider(p))
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

  const handleInstallCLI = async (providerId: string) => {
    setInstalling(providerId);
    try {
      await aiStore.installCLI(providerId);
    } finally {
      setInstalling(null);
    }
  };

  const handleLoginCLI = async (providerId: string) => {
    setLoggingIn(providerId);
    try {
      await aiStore.startCLILogin(providerId);
    } finally {
      setLoggingIn(null);
    }
  };

  const handleLogoutCLI = async (providerId: string) => {
    try {
      await aiStore.logoutCLI(providerId);
    } catch (err) {
      // Some CLIs (e.g. Kimi Code) do not expose a logout command.
      // We still want to let the user deactivate the provider locally.
      if (!String(err).includes("logout not supported")) {
      }
    } finally {
      aiStore.setActiveCLIProvider(null);
      await aiStore.loadCLIStatuses();
    }
  };

  const handleSelectCLI = (providerId: string) => {
    const status = aiStore.cliStatuses[providerId];
    if (status?.authenticated) {
      aiStore.setActiveCLIProvider(providerId);
    }
  };

  const handleCopilotConnect = async () => {
    const clientId = copilotClientIdInput.trim();
    if (!clientId) return;

    setCopilotError(null);
    setCopilotUserCode(null);
    setCopilotVerificationUri(null);
    setCopilotPolling(true);

    try {
      const start = await aiStore.startCopilotDeviceLogin(clientId);
      setCopilotUserCode(start.user_code);
      setCopilotVerificationUri(start.verification_uri);

      const verificationUrl = `${start.verification_uri}?user_code=${encodeURIComponent(start.user_code)}`;
      void invoke("open_external_url", { url: verificationUrl });

      const deadline = Date.now() + start.expires_in * 1000;
      const poll = async () => {
        if (Date.now() >= deadline) {
          setCopilotPolling(false);
          setCopilotError("Login code expired. Please try again.");
          return;
        }

        try {
          const authorized = await aiStore.pollCopilotDeviceLogin(clientId, start.device_code);
          if (authorized) {
            setCopilotPolling(false);
            setCopilotUserCode(null);
            setCopilotVerificationUri(null);
            return;
          }
          setTimeout(poll, start.interval * 1000);
        } catch (err) {
          setCopilotPolling(false);
          setCopilotError(String(err));
        }
      };

      setTimeout(poll, start.interval * 1000);
    } catch (err) {
      setCopilotPolling(false);
      setCopilotError(String(err));
    }
  };

  const handleCopilotDisconnect = async () => {
    await aiStore.logoutCopilot();
    setCopilotUserCode(null);
    setCopilotVerificationUri(null);
    setCopilotError(null);
  };

  const handleOpenVerificationUrl = () => {
    if (copilotVerificationUri && copilotUserCode) {
      void invoke("open_external_url", {
        url: `${copilotVerificationUri}?user_code=${encodeURIComponent(copilotUserCode)}`,
      });
    }
  };

  const configured = isProviderConfigured(
    activeProvider,
    providerConfig,
    apiKeyRef,
    aiStore.copilotAuth.authenticated,
  );

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Provider">
        <SettingRow
          label="Default Provider"
          description="AI provider used for chat and inline completion"
          control={
            <Select
              value={activeProvider}
              onValueChange={(v) => handleProviderChange(v as AIProvider)}
            >
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

        <div className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-root px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${configured ? "bg-status-success" : "bg-fg-subtle"}`}
            />
            <span className="text-ui-sm text-fg-default">{PROVIDER_LABELS[activeProvider]}</span>
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

        <ModelSelect
          provider={activeProvider}
          value={providerConfig.model}
          onChange={handleModelChange}
        />

        {(activeProvider === "ollama" || activeProvider === "custom") && (
          <SettingRow
            label="Base URL"
            description="Endpoint for OpenAI-compatible requests"
            control={
              <Input
                value={providerConfig.baseUrl ?? ""}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder={
                  activeProvider === "ollama"
                    ? "http://localhost:11434"
                    : "https://api.example.com/v1"
                }
                className="max-w-[200px]"
              />
            }
          />
        )}

        {needsKey && (
          <SettingRow
            label="API Key"
            description="Stored securely in the system keychain"
            control={
              <div className="flex max-w-[280px] flex-col gap-1">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && keyInput.trim()) {
                          void handleSaveKey();
                        }
                      }}
                      placeholder={apiKeyRef ? `Key saved (${apiKeyRef})` : "Enter API key"}
                      className="w-full pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-muted transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.92] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:text-fg-default"
                    >
                      {showKey ? <EyeSlash size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveKey}
                    disabled={!keyInput.trim()}
                    className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <FloppyDisk size={14} />
                  </Button>
                  {apiKeyRef && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteKey}
                      className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Trash size={14} />
                    </Button>
                  )}
                </div>
                {keySaveStatus && (
                  <span
                    className={
                      keySaveStatus.type === "ok"
                        ? "text-ui-xs text-status-success"
                        : "text-ui-xs text-status-error"
                    }
                  >
                    {keySaveStatus.type === "ok" && (
                      <CheckCircle size={12} className="mr-1 inline" />
                    )}
                    {keySaveStatus.type === "error" && (
                      <XCircle size={12} className="mr-1 inline" />
                    )}
                    {keySaveStatus.message}
                  </span>
                )}
              </div>
            }
          />
        )}

        {activeProvider === "copilot" && (
          <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-root p-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-ui-sm text-fg-default">GitHub OAuth Client ID</span>
              <span className="text-ui-xs text-fg-muted">
                Create a GitHub OAuth App and paste its Client ID here.
              </span>
              <Input
                value={copilotClientIdInput}
                onChange={(e) => {
                  setCopilotClientIdInput(e.target.value);
                  aiStore.setCopilotClientId(e.target.value);
                }}
                placeholder="e.g. Iv23li..."
                disabled={copilotPolling || aiStore.copilotAuth.authenticated}
              />
            </div>

            {aiStore.copilotAuth.authenticated ? (
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-1 text-ui-xs text-status-success">
                  <CheckCircle size={14} /> Connected to GitHub Copilot
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopilotDisconnect}
                  disabled={copilotPolling}
                  className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <SignOut size={14} className="mr-1" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleCopilotConnect}
                disabled={!copilotClientIdInput.trim() || copilotPolling}
                className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <SignIn size={14} className="mr-1" />
                {copilotPolling ? "Waiting for authorization..." : "Connect GitHub Account"}
              </Button>
            )}

            {copilotUserCode && copilotVerificationUri && (
              <div className="flex flex-col gap-1.5">
                <span className="text-ui-xs text-fg-muted">
                  Enter this code on GitHub if the browser did not open:
                </span>
                <code className="rounded bg-bg-surface px-2 py-1 text-center text-ui-sm font-mono">
                  {copilotUserCode}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenVerificationUrl}
                  disabled={copilotPolling}
                  className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Open GitHub
                </Button>
              </div>
            )}

            {copilotError && <p className="text-ui-xs text-status-error">{copilotError}</p>}
          </div>
        )}

        <div className="flex flex-col items-start gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testStatus === "loading" || !configured}
            className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {testStatus === "loading" ? "Testing..." : "Test Connection"}
          </Button>
          {testError && <p className="text-ui-xs text-status-error">{testError}</p>}
        </div>
      </SettingSection>

      <SettingSection
        title="Local CLI Integration"
        badge={{ label: "Experimental", variant: "warning" }}
      >
        <div className="mb-3 flex items-center justify-between rounded-md border border-border-subtle bg-bg-root p-3">
          <div className="flex flex-col">
            <span className="text-ui-sm font-medium text-fg-default">
              Enable local CLI integration
            </span>
            <span className="text-ui-xs text-fg-muted">
              Turn on experimental support for provider CLIs like Kimi Code.
            </span>
          </div>
          <Switch
            checked={settingsStore.experimental.acp}
            onCheckedChange={(v) => settingsStore.setExperimentalEnabled("acp", v)}
            aria-label="Enable experimental local CLI integration"
          />
        </div>

        {!settingsStore.experimental.acp && (
          <p className="mb-3 text-ui-xs text-status-warning">
            Local CLI integration is currently disabled. Enable the toggle above to use it.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-ui-xs text-fg-muted">
            Pragma wraps official provider CLI tools that run locally on your machine. It does not
            provide models, accounts, or credentials — authentication happens independently in the
            CLI.
          </p>
          <p className="text-ui-xs text-fg-muted">
            Kimi Code CLI is published by Moonshot AI under the MIT License and is installed from
            its official npm registry. Pragma is not affiliated with Moonshot AI.
          </p>

          {aiStore.cliManifests.length === 0 && (
            <p className="text-ui-sm text-fg-muted">Loading providers...</p>
          )}

          {aiStore.cliManifests.map((manifest) => {
            const status = aiStore.cliStatuses[manifest.id];
            const isActive = aiStore.activeCLIProvider === manifest.id;
            const isInstalling = installing === manifest.id;
            const isLoggingIn = loggingIn === manifest.id;

            return (
              <div
                key={manifest.id}
                className={`flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-root p-3 ${isActive ? "ring-1 ring-primary" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]">
                    <Robot size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-ui-sm font-medium">{manifest.name}</span>
                      {status?.installed && (
                        <span className="rounded-full bg-[var(--color-status-success-bg)] px-1.5 py-0.5 text-ui-xs text-status-success">
                          Installed
                        </span>
                      )}
                      {status?.authenticated && (
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-1.5 py-0.5 text-ui-xs text-primary">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-ui-xs text-fg-muted">{manifest.description}</p>
                    {status?.version && (
                      <p className="text-ui-xs text-fg-muted">v{status.version}</p>
                    )}
                    {status?.user && (
                      <p className="text-ui-xs text-fg-muted">Signed in as {status.user}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!status?.installed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInstallCLI(manifest.id)}
                      disabled={isInstalling}
                      className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <DownloadSimple size={14} className="mr-1" />
                      {isInstalling ? "Installing..." : "Install Official CLI"}
                    </Button>
                  )}

                  {status?.installed && !status?.authenticated && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLoginCLI(manifest.id)}
                      disabled={isLoggingIn}
                      className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <SignIn size={14} className="mr-1" />
                      {isLoggingIn ? "Opening login..." : "Login with CLI"}
                    </Button>
                  )}

                  {status?.authenticated && (
                    <>
                      <Button
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        onClick={() => handleSelectCLI(manifest.id)}
                        className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {isActive ? "Active" : "Use This"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLogoutCLI(manifest.id)}
                        className="transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <SignOut size={14} className="mr-1" />
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>

                {status?.error && <p className="text-ui-xs text-status-error">{status.error}</p>}
              </div>
            );
          })}
        </div>
      </SettingSection>

      <SettingSection title="Inline Completion">
        <SettingRow
          label="Enable"
          description="Show AI ghost-text suggestions in the editor"
          control={
            <Switch
              checked={settingsStore.ai.inlineCompletion}
              onCheckedChange={(v) => settingsStore.setAISettings({ inlineCompletion: v })}
            />
          }
        />
        <SettingRow
          label="Debounce"
          description="Milliseconds to wait before requesting a suggestion"
          control={
            <Input
              type="number"
              min={100}
              step={50}
              value={settingsStore.ai.completionDebounce}
              onChange={(e) =>
                settingsStore.setAISettings({ completionDebounce: Number(e.target.value) })
              }
              className="max-w-[180px]"
            />
          }
        />
      </SettingSection>

      <SettingSection title="Terminal AI">
        <SettingRow
          label="Enable"
          description="Show AI command suggestions in the terminal"
          control={
            <Switch
              checked={settingsStore.ai.terminalSuggestions}
              onCheckedChange={(v) => settingsStore.setAISettings({ terminalSuggestions: v })}
            />
          }
        />
      </SettingSection>
    </div>
  );
}

interface ModelSelectProps {
  provider: AIProvider;
  value: string;
  onChange: (model: string) => void;
}

function ModelSelect({ provider, value, onChange }: ModelSelectProps) {
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
        <span className="text-ui-xs text-status-error">Could not load models: {error}</span>
      )}
    </div>
  );
}
