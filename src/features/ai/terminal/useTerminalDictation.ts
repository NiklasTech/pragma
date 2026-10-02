import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import { useSettingsStore } from "@/shared/stores/settings";
import {
  useComposerDictation,
  type UseComposerDictationResult,
} from "@/features/ai/dictation/useComposerDictation";
import { usePushToTalk } from "@/features/ai/dictation/usePushToTalk";

import { writeTerminal } from "./runner";

export interface TerminalDictation {
  available: boolean;
  /** Local engines report a microphone level; Web Speech does not. */
  metered: boolean;
  dictation: UseComposerDictationResult;
}

/// Dictation for a terminal agent: the final transcript is typed into the PTY without Enter.
/// Mounting it claims the hold-to-dictate shortcut, so only the focused pane should use it.
export function useTerminalDictation(sessionId: string): TerminalDictation {
  const voiceInput = useSettingsStore((state) => state.ai.voiceInput);
  const voiceEngine = useSettingsStore((state) => state.ai.voiceEngine);
  const voiceModel = useSettingsStore((state) =>
    state.ai.voiceEngine === "whisper" ? state.ai.whisperModel : state.ai.parakeetModel,
  );
  const holdToDictate = useSettingsStore((state) => state.shortcuts["voice.holdToDictate"]);

  const handleText = useCallback(
    (text: string, final: boolean) => {
      const transcript = text.trim();
      if (!final || !transcript) return;
      void writeTerminal(sessionId, transcript);
    },
    [sessionId],
  );

  const dictation = useComposerDictation({
    engine: voiceEngine,
    model: voiceModel,
    enabled: voiceInput,
    onText: handleText,
  });

  usePushToTalk({
    enabled: voiceInput,
    binding: holdToDictate,
    start: dictation.start,
    stop: dictation.stop,
  });
  useEffect(() => {
    if (dictation.status) toast.error(dictation.status);
  }, [dictation.status]);

  return { available: voiceInput, metered: voiceEngine !== "web-speech", dictation };
}
