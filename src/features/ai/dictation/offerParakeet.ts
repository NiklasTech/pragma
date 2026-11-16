import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { openSettings } from "@/features/settings/openSettings";
import { useSettingsStore } from "@/shared/stores/settings";

import type { SttStatus } from "./useComposerDictation";

/// Asks once whether someone still on Web Speech wants Parakeet, the local default since E5.
export async function offerParakeet(): Promise<void> {
  const { ai, setAISettings } = useSettingsStore.getState();
  if (ai.voiceEngine !== "web-speech" || ai.parakeetOffered) return;
  const status = await invoke<SttStatus>("parakeet_status", { model: ai.parakeetModel }).catch(
    () => null,
  );
  if (!status?.supported) return;
  setAISettings({ parakeetOffered: true });
  toast("Switch dictation to Parakeet?", {
    description:
      "Pragma's new default keeps your audio on this device. It needs a one-time download.",
    duration: 15_000,
    action: {
      label: "Use Parakeet",
      onClick: () => {
        useSettingsStore.getState().setAISettings({ voiceEngine: "parakeet" });
        openSettings("agents", "Voice input");
      },
    },
    cancel: { label: "Keep", onClick: () => undefined },
  });
}
