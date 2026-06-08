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
import { Eye, EyeSlash, FloppyDisk, Trash, CheckCircle, XCircle } from "@phosphor-icons/react";

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  ollama: "Ollama",
  deepseek: "DeepSeek",
  kimi: "Kimi",
  custom: "Custom",
};

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ["gpt-4o", "o1", "o3"],
  anthropic: ["claude-opus-4", "claude-sonnet-4", "claude-haiku"],
  ollama: ["llama3.2", "codellama", "mistral", "phi4"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  kimi: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  custom: [],
};

const NEEDS_KEY: AIProvider[] = ["openai", "anthropic", "deepseek", "kimi", "custom"];

export function AISettings() {
  const aiStore = useAIStore();
  const settingsStore = useSettingsStore();

  const [keyInput, setKeyInput] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");

  const activeProvider = settingsStore.ai.defaultProvider;
  const providerConfig = settingsStore.ai.providers[activeProvider];
  const apiKeyRef = aiStore.apiKeyRefs[activeProvider];
  const needsKey = NEEDS_KEY.includes(activeProvider);

  React.useEffect(() => {
    NEEDS_KEY.forEach((p) => aiStore.loadKeyStatus(p));
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

  return (
    <div className="flex flex-col gap-4">
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
              {apiKeyRef && <p className="text-xs text-muted-foreground">Saved key: {apiKeyRef}</p>}
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
    </div>
  );
}
