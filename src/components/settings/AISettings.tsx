"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAIStore, type AIProvider } from "@/stores/ai";
import { useSettingsStore } from "@/stores/settings";
import { PROVIDER_LABELS, PROVIDER_MODELS } from "@/lib/ai-providers";
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
  Terminal,
  Globe,
  Cpu,
} from "@phosphor-icons/react";

type AuthTab = "cli" | "apikey" | "ollama";

const NEEDS_KEY: AIProvider[] = ["openai", "anthropic", "deepseek", "kimi", "custom"];

export function AISettings() {
  const aiStore = useAIStore();
  const settingsStore = useSettingsStore();
  const [activeTab, setActiveTab] = React.useState<AuthTab>("cli");

  const [keyInput, setKeyInput] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [installing, setInstalling] = React.useState<string | null>(null);
  const [loggingIn, setLoggingIn] = React.useState<string | null>(null);

  const activeProvider = settingsStore.ai.defaultProvider;
  const providerConfig = settingsStore.ai.providers[activeProvider];
  const apiKeyRef = aiStore.apiKeyRefs[activeProvider];
  const needsKey = NEEDS_KEY.includes(activeProvider);

  React.useEffect(() => {
    NEEDS_KEY.forEach((p) => void aiStore.loadKeyStatus(p));
    void aiStore.loadCLIManifests();
    void aiStore.loadCLIStatuses();
  }, []);

  const handleProviderChange = (provider: AIProvider) => {
    settingsStore.setAISettings({ defaultProvider: provider });
    const models = PROVIDER_MODELS[provider];
    if (models.length > 0) {
      settingsStore.updateProvider(provider, { model: models[0] });
      settingsStore.setAISettings({ defaultModel: models[0] });
    }
    setKeyInput("");
    setTestStatus("idle");
  };

  const handleModelChange = (model: string) => {
    settingsStore.updateProvider(activeProvider, { model });
    settingsStore.setAISettings({ defaultModel: model });
  };

  const handleBaseUrlChange = (baseUrl: string) => {
    settingsStore.updateProvider(activeProvider, { baseUrl });
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    await aiStore.storeApiKey(activeProvider, keyInput.trim());
    setKeyInput("");
  };

  const handleDeleteKey = async () => {
    await aiStore.deleteApiKey(activeProvider);
    setKeyInput("");
  };

  const handleTest = async () => {
    setTestStatus("loading");
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTestStatus("ok");
    } catch {
      setTestStatus("error");
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
    await aiStore.logoutCLI(providerId);
  };

  const handleSelectCLI = (providerId: string) => {
    const status = aiStore.cliStatuses[providerId];
    if (status?.authenticated) {
      aiStore.setActiveCLIProvider(providerId);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Auth Mode Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setActiveTab("cli")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "cli"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Terminal size={14} />
          CLI Subscription
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("apikey")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "apikey"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe size={14} />
          API Key
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ollama")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "ollama"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Cpu size={14} />
          Local
        </button>
      </div>

      {/* ─── CLI Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "cli" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Use your existing subscription via official CLI tools. Pragma installs and manages them
            automatically.
          </p>

          {aiStore.cliManifests.length === 0 && (
            <p className="text-sm text-muted-foreground">Loading providers...</p>
          )}

          {aiStore.cliManifests.map((manifest) => {
            const status = aiStore.cliStatuses[manifest.id];
            const isActive = aiStore.activeCLIProvider === manifest.id;
            const isInstalling = installing === manifest.id;
            const isLoggingIn = loggingIn === manifest.id;

            return (
              <Card
                key={manifest.id}
                className={`transition-colors ${isActive ? "border-primary/50" : ""}`}
              >
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Robot size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{manifest.name}</p>
                        {status?.installed && (
                          <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-500">
                            Installed
                          </span>
                        )}
                        {status?.authenticated && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{manifest.description}</p>
                      {status?.version && (
                        <p className="text-[10px] text-muted-foreground">v{status.version}</p>
                      )}
                      {status?.user && (
                        <p className="text-[10px] text-muted-foreground">
                          Signed in as {status.user}
                        </p>
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
                      >
                        <DownloadSimple size={14} className="mr-1" />
                        {isInstalling ? "Installing..." : "Install"}
                      </Button>
                    )}

                    {status?.installed && !status?.authenticated && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoginCLI(manifest.id)}
                        disabled={isLoggingIn}
                      >
                        <SignIn size={14} className="mr-1" />
                        {isLoggingIn ? "Connecting..." : "Connect Account"}
                      </Button>
                    )}

                    {status?.authenticated && (
                      <>
                        <Button
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          onClick={() => handleSelectCLI(manifest.id)}
                        >
                          {isActive ? "Active" : "Use This"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleLogoutCLI(manifest.id)}
                        >
                          <SignOut size={14} className="mr-1" />
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>

                  {status?.error && <p className="text-xs text-destructive">{status.error}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── API Key Tab ─────────────────────────────────────────────────── */}
      {activeTab === "apikey" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>AI Provider</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Default Provider</Label>
                  <Select
                    value={activeProvider}
                    onValueChange={(v) => handleProviderChange(v as AIProvider)}
                  >
                    <SelectTrigger className="w-full">
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
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Model</Label>
                  <Select
                    value={providerConfig.model}
                    onValueChange={(v) => {
                      if (v) handleModelChange(v);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_MODELS[activeProvider].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                      {activeProvider === "custom" && providerConfig.model && (
                        <SelectItem value={providerConfig.model}>{providerConfig.model}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(activeProvider === "ollama" || activeProvider === "custom") && (
                <div className="flex flex-col gap-1.5">
                  <Label>Base URL</Label>
                  <Input
                    value={providerConfig.baseUrl ?? ""}
                    onChange={(e) => handleBaseUrlChange(e.target.value)}
                    placeholder={
                      activeProvider === "ollama"
                        ? "http://localhost:11434"
                        : "https://api.example.com/v1"
                    }
                  />
                </div>
              )}

              {needsKey && (
                <div className="flex flex-col gap-1.5">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder={apiKeyRef ? "Key saved (" + apiKeyRef + ")" : "Enter API key"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((s) => !s)}
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? <EyeSlash size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <Button size="sm" onClick={handleSaveKey} disabled={!keyInput.trim()}>
                      <FloppyDisk size={14} />
                      Save
                    </Button>
                    {apiKeyRef && (
                      <Button size="sm" variant="destructive" onClick={handleDeleteKey}>
                        <Trash size={14} />
                      </Button>
                    )}
                  </div>
                  {apiKeyRef && (
                    <p className="text-xs text-muted-foreground">Saved key: {apiKeyRef}</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testStatus === "loading"}
                >
                  {testStatus === "loading" ? "Testing..." : "Test Connection"}
                </Button>
                {testStatus === "ok" && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle size={14} /> Connected
                  </span>
                )}
                {testStatus === "error" && (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <XCircle size={14} /> Failed
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Inline Completion</Label>
                <Switch
                  checked={settingsStore.ai.inlineCompletion}
                  onCheckedChange={(v) => settingsStore.setAISettings({ inlineCompletion: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Terminal Suggestions</Label>
                <Switch
                  checked={settingsStore.ai.terminalSuggestions}
                  onCheckedChange={(v) => settingsStore.setAISettings({ terminalSuggestions: v })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Completion Debounce (ms)</Label>
                <Input
                  type="number"
                  value={settingsStore.ai.completionDebounce}
                  onChange={(e) =>
                    settingsStore.setAISettings({ completionDebounce: Number(e.target.value) })
                  }
                  className="w-24"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Ollama Tab ──────────────────────────────────────────────────── */}
      {activeTab === "ollama" && (
        <Card>
          <CardHeader>
            <CardTitle>Ollama — Local Models</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Run AI models locally on your machine. Completely free, works offline, 100% private.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label>Base URL</Label>
              <Input
                value={settingsStore.ai.providers.ollama.baseUrl ?? "http://localhost:11434"}
                onChange={(e) =>
                  settingsStore.updateProvider("ollama", { baseUrl: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Model</Label>
              <Select
                value={settingsStore.ai.providers.ollama.model}
                onValueChange={(v) => v && settingsStore.updateProvider("ollama", { model: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS.ollama.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Not installed?</p>
              <code className="block bg-card rounded px-2 py-1 mt-1">
                curl -fsSL https://ollama.com/install.sh | sh
              </code>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
