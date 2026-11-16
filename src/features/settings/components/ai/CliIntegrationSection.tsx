"use client";

import * as React from "react";

import { Info } from "@phosphor-icons/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { aiProviderForCLI } from "@/shared/lib/ai-providers";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { SettingSection } from "../ui/SettingSection";
import { CliProviderCard } from "./CliProviderCard";

export function CliIntegrationSection() {
  const aiStore = useAIStore();
  const settingsStore = useSettingsStore();

  const [installing, setInstalling] = React.useState<string | null>(null);
  const [loggingIn, setLoggingIn] = React.useState<string | null>(null);

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
      settingsStore.setAISettings({ cliProvider: null });
      await aiStore.loadCLIStatuses();
    }
  };

  const handleSelectCLI = (providerId: string) => {
    const status = aiStore.cliStatuses[providerId];
    if (status?.authenticated) {
      aiStore.setActiveCLIProvider(providerId);
      settingsStore.setAISettings({ cliProvider: providerId });
      const provider = aiProviderForCLI(providerId);
      if (provider) {
        aiStore.setActiveProvider(provider);
        settingsStore.setAISettings({ defaultProvider: provider });
      }
    }
  };

  return (
    <SettingSection
      title="Coding CLIs"
      action={
        <Tooltip>
          <TooltipTrigger
            type="button"
            delay={100}
            aria-label="About coding CLIs"
            className="flex items-center text-fg-subtle transition-colors hover:text-fg-default"
          >
            <Info size={14} />
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <span className="flex flex-col gap-2">
              <span>
                Pragma can speak the Agent Client Protocol (ACP) with supported CLIs running
                locally. ACP turns use the subscription you signed into in the official CLI. API
                keys under Editor, Models are a separate path: they stay in Pragma's own request
                loop and are never handed to a CLI.
              </span>
              <span>
                Nothing is installed or launched until you press Install, and a CLI only runs while
                it is the active provider. Codex CLI is published by OpenAI, Claude Code by
                Anthropic, Gemini CLI by Google, GitHub Copilot CLI by GitHub, Kimi Code by Moonshot
                AI, Grok Build by xAI, Cursor CLI by Cursor, OpenCode by the OpenCode project,
                Hermes Agent by Nous Research, and DeepSeek Harness by DeepSeek, each distributed
                separately. Pragma runs the unmodified official CLIs and is not affiliated with any
                of these vendors.
              </span>
            </span>
          </TooltipContent>
        </Tooltip>
      }
    >
      <div className="flex flex-col divide-y divide-border-subtle">
        {aiStore.cliManifests.length === 0 && (
          <p className="py-3 text-ui-sm text-fg-muted">Loading providers...</p>
        )}

        {aiStore.cliManifests.map((manifest) => {
          const status = aiStore.cliStatuses[manifest.id];
          const isActive = aiStore.activeCLIProvider === manifest.id;
          const isInstalling = installing === manifest.id;
          const isLoggingIn = loggingIn === manifest.id;

          return (
            <CliProviderCard
              key={manifest.id}
              manifest={manifest}
              status={status}
              isActive={isActive}
              isInstalling={isInstalling}
              isLoggingIn={isLoggingIn}
              onInstall={() => handleInstallCLI(manifest.id)}
              onLogin={() => handleLoginCLI(manifest.id)}
              onSelect={() => handleSelectCLI(manifest.id)}
              onLogout={() => handleLogoutCLI(manifest.id)}
            />
          );
        })}
      </div>
    </SettingSection>
  );
}
