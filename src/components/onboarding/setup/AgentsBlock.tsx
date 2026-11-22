import { useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { useAIStore, type CLIManifest } from "@/shared/stores/ai";
import { refreshCLIStatuses } from "@/shared/stores/ai/cliRefresh";
import { useSettingsStore } from "@/shared/stores/settings";
import { isProviderConfigured } from "@/features/settings/components/AISettings";
import { openSettings } from "@/features/settings/openSettings";
import {
  ACCOUNT_PROVIDERS,
  CliAccountRows,
} from "@/features/settings/components/ai/CliAccountRows";
import { CliTile } from "@/features/settings/components/ai/CliTile";

/** How many coding CLIs are installed and signed in. */
export function useSignedInAgents(): number {
  return useAIStore(
    (state) => Object.values(state.cliStatuses).filter((status) => status.authenticated).length,
  );
}

/** Whether the default AI provider is set up, so Pragma's own agent can run without a CLI. */
export function useApiKeyReady(): boolean {
  const provider = useSettingsStore((state) => state.ai.defaultProvider);
  const config = useSettingsStore((state) => state.ai.providers[state.ai.defaultProvider]);
  const keyRef = useAIStore((state) => state.apiKeyRefs[provider] ?? null);
  const copilot = useAIStore((state) => state.copilotAuth.authenticated);
  const statuses = useAIStore((state) => state.cliStatuses);
  return isProviderConfigured(provider, config, keyRef, copilot, statuses);
}

const NO_QUICK_KEY = () => null;

/// The coding CLIs on this machine: install, sign in and add accounts, as in Settings › Agents.
export function AgentsBlock() {
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const installCLI = useAIStore((state) => state.installCLI);
  const startCLILogin = useAIStore((state) => state.startCLILogin);
  const logoutCLI = useAIStore((state) => state.logoutCLI);
  const loadCLIStatuses = useAIStore((state) => state.loadCLIStatuses);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (manifests.length === 0) void loadCLIManifests();
    void refreshCLIStatuses();
    // A sign-in finishes in the browser or a terminal; coming back picks it up.
    const onFocus = () => void refreshCLIStatuses();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadCLIManifests, manifests.length]);

  const run = async (id: string, action: (id: string) => Promise<unknown>) => {
    setBusy(id);
    try {
      await action(id);
    } finally {
      setBusy(null);
      await loadCLIStatuses();
    }
  };

  const installed = manifests.filter((manifest) => statuses[manifest.id]?.installed);
  const missing = manifests.filter((manifest) => !statuses[manifest.id]?.installed);

  const tile = (manifest: CLIManifest) => (
    <div key={manifest.id} className="flex flex-col">
      <CliTile
        manifest={manifest}
        status={statuses[manifest.id]}
        quickKey={null}
        busy={busy === manifest.id}
        onInstall={() => void run(manifest.id, installCLI)}
        onSignIn={() => void run(manifest.id, startCLILogin)}
        onSignOut={() => void run(manifest.id, logoutCLI)}
      />
      {statuses[manifest.id]?.installed && ACCOUNT_PROVIDERS.has(manifest.id) && (
        <CliAccountRows providerId={manifest.id} quickKeyOf={NO_QUICK_KEY} />
      )}
    </div>
  );

  if (manifests.length === 0) {
    return <p className="text-ui-sm text-fg-muted">Looking for coding CLIs…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-ui-sm leading-relaxed text-fg-muted">
        Pragma starts these CLIs with your own sign-in and subscription; it provides no models.
      </p>
      <div className="flex flex-col">{installed.map(tile)}</div>
      {missing.length > 0 && (
        <Collapsible defaultOpen={installed.length === 0}>
          <CollapsibleTrigger className="group flex w-full min-w-0 items-center gap-2 rounded-[4px] py-1 text-left font-mono text-ui-2xs text-fg-subtle hover:text-fg-default">
            <CaretRight
              size={10}
              aria-hidden="true"
              className="shrink-0 transition-transform group-data-[panel-open]:rotate-90"
            />
            <span className="shrink-0">+ {missing.length} not installed</span>
            <span className="min-w-0 truncate">
              {missing.map((manifest) => manifest.name).join(", ")}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col">{missing.map(tile)}</div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <Button
        variant="ghost"
        onClick={() => openSettings("editor", "Models")}
        className="h-auto self-start px-0 font-mono text-ui-xs text-primary hover:bg-transparent hover:underline"
      >
        or use an API key instead
      </Button>
    </div>
  );
}
