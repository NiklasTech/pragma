import { useEffect, useRef } from "react";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

type AISettingsState = ReturnType<typeof useSettingsStore.getState>["ai"];

const SYNCED_FIELDS = {
  defaultProvider: "activeProvider",
  defaultModel: "activeModel",
  providers: "providers",
  inlineCompletion: "inlineCompletion",
  completionDebounce: "completionDebounce",
  terminalSuggestions: "terminalSuggestions",
  terminalSuggestionProvider: "terminalSuggestionProvider",
  terminalSuggestionModel: "terminalSuggestionModel",
} as const satisfies Partial<
  Record<keyof AISettingsState, keyof ReturnType<typeof useAIStore.getState>>
>;

/// Copies the persisted AI settings into the runtime store; with `previous`, only changed fields.
export function syncAIStore(ai: AISettingsState, previous?: AISettingsState): void {
  const patch: Partial<ReturnType<typeof useAIStore.getState>> = {};
  for (const [from, to] of Object.entries(SYNCED_FIELDS) as Array<
    [keyof typeof SYNCED_FIELDS, (typeof SYNCED_FIELDS)[keyof typeof SYNCED_FIELDS]]
  >) {
    if (!previous || ai[from] !== previous[from]) Object.assign(patch, { [to]: ai[from] });
  }
  if (Object.keys(patch).length > 0) useAIStore.setState(patch);
}

/**
 * Initializes AI provider status checks on app mount.
 * This ensures CLI providers are discovered even if the user
 * never opens the Settings page.
 */
export function useAIInit() {
  const { loadCLIStatuses, loadCLIManifests, loadKeyStatus, loadCopilotAuthStatus } = useAIStore();
  const statusesLoaded = useRef(false);

  useEffect(() => {
    let unsubscribeSettings: (() => void) | null = null;

    const start = () => {
      const settings = useSettingsStore.getState();
      syncAIStore(settings.ai);
      // Settings can change in this window, another window or an import; keep the runtime store in step.
      unsubscribeSettings = useSettingsStore.subscribe((next, previous) => {
        if (next.ai !== previous.ai) syncAIStore(next.ai, previous.ai);
      });

      if (statusesLoaded.current) return;
      statusesLoaded.current = true;

      // Load CLI manifests and statuses on app start
      void loadCLIManifests();
      void loadCLIStatuses();

      // Other providers are checked when settings opens, so startup raises at most one keychain dialog.
      if (settings.ai.defaultProvider !== "ollama") {
        void loadKeyStatus(settings.ai.defaultProvider);
      }

      // Load GitHub Copilot OAuth status
      void loadCopilotAuthStatus();
    };

    if (useSettingsStore.persist.hasHydrated()) {
      start();
      return () => unsubscribeSettings?.();
    }

    const unsubscribeHydration = useSettingsStore.persist.onFinishHydration(start);
    return () => {
      unsubscribeHydration();
      unsubscribeSettings?.();
    };
  }, [loadCLIStatuses, loadCLIManifests, loadKeyStatus, loadCopilotAuthStatus]);
}
