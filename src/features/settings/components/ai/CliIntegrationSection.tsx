"use client";

import * as React from "react";

import { Info } from "@phosphor-icons/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { aiProviderForCLI } from "@/shared/lib/ai-providers";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { SettingSection } from "../ui/SettingSection";
import { quickAgents } from "@/features/ai/quickStart/quickStart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { SettingRow } from "../ui/SettingRow";
import { CliTile } from "./CliTile";

const NONE = "__none__";

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

  const clearDefault = () => {
    aiStore.setActiveCLIProvider(null);
    settingsStore.setAISettings({ cliProvider: null });
  };

  const { ready } = quickAgents(aiStore.cliManifests, aiStore.cliStatuses);
  const isInstalled = (id: string) => aiStore.cliStatuses[id]?.installed === true;
  // Quick start's order first, so the numbers read 1, 2, 3 across the grid.
  const installed = [
    ...ready,
    ...aiStore.cliManifests.filter((m) => isInstalled(m.id) && !ready.includes(m)),
  ];
  const missing = aiStore.cliManifests.filter((m) => !isInstalled(m.id));
  const signedIn = installed.filter((m) => aiStore.cliStatuses[m.id]?.authenticated);
  const quickKeyOf = (id: string): number | null => {
    const index = ready.findIndex((m) => m.id === id);
    return index >= 0 && index < 9 ? index + 1 : null;
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
      <div className="flex flex-col gap-3 py-3">
        {aiStore.cliManifests.length === 0 ? (
          <p className="text-ui-sm text-fg-muted">Looking for coding CLIs...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...installed, ...missing].map((manifest) => (
                <CliTile
                  key={manifest.id}
                  manifest={manifest}
                  status={aiStore.cliStatuses[manifest.id]}
                  quickKey={quickKeyOf(manifest.id)}
                  busy={installing === manifest.id || loggingIn === manifest.id}
                  onInstall={() => void handleInstallCLI(manifest.id)}
                  onSignIn={() => void handleLoginCLI(manifest.id)}
                  onSignOut={() => void handleLogoutCLI(manifest.id)}
                />
              ))}
            </div>
            <p className="text-ui-xs text-fg-subtle">
              The number is the key that starts the CLI in New (⌘N).
            </p>
          </>
        )}
      </div>
      <SettingRow
        label="Default agent"
        description="Runs tasks and the chat when you do not pick an agent."
        control={
          <Select
            value={aiStore.activeCLIProvider ?? NONE}
            onValueChange={(value) => {
              if (value === NONE) clearDefault();
              else if (typeof value === "string") handleSelectCLI(value);
            }}
          >
            <SelectTrigger className="max-w-[220px]" aria-label="Default agent">
              <SelectValue>
                {signedIn.find((manifest) => manifest.id === aiStore.activeCLIProvider)?.name ??
                  "None"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {signedIn.map((manifest) => (
                <SelectItem key={manifest.id} value={manifest.id}>
                  {manifest.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </SettingSection>
  );
}
