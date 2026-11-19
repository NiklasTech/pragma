import { toast } from "sonner";

import { openSettings } from "@/features/settings/openSettings";
import { supportsApiKey } from "@/shared/lib/ai-providers";
import { completionReady } from "@/shared/lib/completionReady";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

let shown = false;

/// Says once per run how to set up suggestions while typing, instead of staying silent.
export async function hintMissingCompletionModel(): Promise<void> {
  if (shown || !useSettingsStore.getState().ai.inlineCompletion) return;
  shown = true;
  const provider = useAIStore.getState().activeProvider;
  // Key status loads in the background; check it before saying anything is missing.
  if (provider === "copilot") await useAIStore.getState().loadCopilotAuthStatus();
  else if (supportsApiKey(provider)) await useAIStore.getState().loadKeyStatus(provider);
  const { providers, apiKeyRefs, copilotAuth } = useAIStore.getState();
  if (
    completionReady(provider, providers[provider], apiKeyRefs[provider], copilotAuth.authenticated)
  )
    return;
  toast("Suggestions while typing need a model", {
    description:
      "Add an API key under Settings, Editor, Models, or run a model locally with Ollama. You can also turn suggestions off there.",
    action: { label: "Set up", onClick: () => openSettings("editor", "Models") },
  });
}
