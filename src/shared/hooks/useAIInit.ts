import { useEffect, useRef } from "react";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

/**
 * Initializes AI provider status checks on app mount.
 * This ensures CLI providers are discovered even if the user
 * never opens the Settings page.
 */
export function useAIInit() {
  const { loadCLIStatuses, loadCLIManifests, loadKeyStatus, loadCopilotAuthStatus } = useAIStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    const syncFromSettings = () => {
      if (initialized.current) return;
      initialized.current = true;

      // Sync runtime AI store with persisted settings once on startup.
      const settings = useSettingsStore.getState();
      useAIStore.setState({
        activeProvider: settings.ai.defaultProvider,
        activeModel: settings.ai.defaultModel,
        providers: settings.ai.providers,
        inlineCompletion: settings.ai.inlineCompletion,
        completionDebounce: settings.ai.completionDebounce,
        terminalSuggestions: settings.ai.terminalSuggestions,
        terminalSuggestionProvider: settings.ai.terminalSuggestionProvider,
        terminalSuggestionModel: settings.ai.terminalSuggestionModel,
      });

      // Load CLI manifests and statuses on app start
      void loadCLIManifests();
      void loadCLIStatuses();

      // Check API key statuses for providers that require a key.
      const providers: Array<"openai" | "anthropic" | "deepseek" | "kimi" | "gemini"> = [
        "openai",
        "anthropic",
        "deepseek",
        "kimi",
        "gemini",
      ];
      providers.forEach((p) => void loadKeyStatus(p));

      // Load GitHub Copilot OAuth status
      void loadCopilotAuthStatus();
    };

    if (useSettingsStore.persist.hasHydrated()) {
      syncFromSettings();
    } else {
      const unsub = useSettingsStore.persist.onFinishHydration(syncFromSettings);
      return () => unsub();
    }
  }, [loadCLIStatuses, loadCLIManifests, loadKeyStatus, loadCopilotAuthStatus]);
}
