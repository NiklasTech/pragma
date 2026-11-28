import { useState } from "react";
import { Plug } from "@phosphor-icons/react";
import { useShallow } from "zustand/react/shallow";

import { openSettings } from "@/features/settings/openSettings";
import { Button } from "@/shared/components/ui/button";
import { useAIStore } from "@/shared/stores/ai";

import { providerSetup, type ProviderSetup } from "./providerSetup";

const DISMISSED_KEY = "pragma.providerSetupHintDismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function useProviderSetup(canChat: boolean): ProviderSetup {
  const input = useAIStore(
    useShallow((state) => ({
      cliStatusesLoaded: state.cliStatusesLoaded,
      cliStatuses: state.cliStatuses,
      cliManifests: state.cliManifests,
      activeCLIProvider: state.activeCLIProvider,
      apiKeyRefs: state.apiKeyRefs,
      copilotAuthenticated: state.copilotAuth.authenticated,
      customBaseUrl: state.providers.custom?.baseUrl,
    })),
  );
  return providerSetup({ ...input, canChat });
}

/// Moves the active chat to a coding CLI that is signed in.
function switchChatToCli(cliProviderId: string): void {
  const { chatSessions, activeChatSessionId, updateChatSession } = useAIStore.getState();
  const session = chatSessions.find((item) => item.id === activeChatSessionId);
  if (session) void updateChatSession({ ...session, agentEngine: { kind: "cli", cliProviderId } });
}

/// Says what is missing before a chat can answer: once when nothing is set up at all, otherwise
/// a short line with a way to switch this chat to an engine that is.
export function ProviderSetupHint({ canChat, agentName }: { canChat: boolean; agentName: string }) {
  const setup = useProviderSetup(canChat);
  const [dismissed, setDismissed] = useState(readDismissed);

  if (setup.kind === "ready" || setup.kind === "checking") return null;

  if (setup.kind === "otherEngine") {
    const { cli } = setup;
    return (
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-1">
        <span className="min-w-[160px] flex-1 text-ui-xs text-fg-muted">
          {agentName} is not set up for this chat.
        </span>
        {cli ? (
          <Button size="sm" variant="secondary" onClick={() => switchChatToCli(cli.id)}>
            Use {cli.name}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => openSettings("agents")}>
            Settings
          </Button>
        )}
      </div>
    );
  }

  if (dismissed) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Without storage the hint only stays away until the next start.
    }
    setDismissed(true);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-border bg-bg-surface py-2 pr-2 pl-3">
      <Plug size={15} className="shrink-0 text-fg-subtle" />
      <span className="min-w-[160px] flex-1 text-ui-xs text-fg-muted">
        Sign in to a coding CLI or add an API key to start working with Pragma.
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
        <Button size="sm" onClick={() => openSettings("agents")}>
          Set up
        </Button>
      </span>
    </div>
  );
}
