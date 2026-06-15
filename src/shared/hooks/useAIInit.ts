import { useEffect, useRef } from "react";
import { useAIStore } from "@/shared/stores/ai";

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
    initialized.current = true;

    // Load CLI manifests and statuses on app start
    void loadCLIManifests();
    void loadCLIStatuses();

    // Also check API key statuses for all providers
    const providers: Array<"openai" | "anthropic" | "deepseek" | "kimi" | "custom"> = [
      "openai",
      "anthropic",
      "deepseek",
      "kimi",
      "custom",
    ];
    providers.forEach((p) => void loadKeyStatus(p));

    // Load GitHub Copilot OAuth status
    void loadCopilotAuthStatus();
  }, [loadCLIStatuses, loadCLIManifests, loadKeyStatus, loadCopilotAuthStatus]);
}
