"use client";

import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";

import { openMicrophoneSettings } from "./microphonePermission";
import { VOICE_INPUT_DENIED } from "./webSpeech";

/** Whether a dictation message means the system blocks the microphone. */
export function isMicrophoneDenied(status: string | null): boolean {
  return status === VOICE_INPUT_DENIED;
}

export function openMicrophoneSettingsOrToast(): void {
  void openMicrophoneSettings().catch((err: unknown) => toast.error(String(err)));
}

/// The last dictation message under the composer; a blocked microphone links to its setting.
export function DictationStatus({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <p className="flex items-center gap-2 px-3 text-ui-2xs text-fg-muted">
      {status}
      {isMicrophoneDenied(status) && (
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0 text-ui-2xs"
          onClick={openMicrophoneSettingsOrToast}
        >
          Open System Settings
        </Button>
      )}
    </p>
  );
}
