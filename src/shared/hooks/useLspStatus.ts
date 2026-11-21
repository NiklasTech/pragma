import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { installTypeScript } from "@/features/editor/lsp/installTypeScript";
import {
  isMissingTypeScript,
  lspErrorMessage,
  shouldToastLspError,
} from "@/shared/lib/lsp-servers";
import { firstLspFailure } from "@/shared/lib/lspToastOnce";
import { recordLspStatus } from "@/shared/stores/lspFailures";
import { useSettingsStore } from "@/shared/stores/settings";
import { unlistenQuietly } from "@/shared/lib/unlisten";

interface LspStatusEvent {
  language: string;
  project_root: string;
  status: "stopped" | "starting" | "running" | "error";
  error?: string;
  expected?: boolean;
}

export function useLspStatus() {
  const experimentalLsp = useSettingsStore((state) => state.experimental.lsp);

  useEffect(() => {
    if (!experimentalLsp) {
      return;
    }

    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<LspStatusEvent>("lsp_status_changed", (event) => {
        recordLspStatus(event.payload.language, event.payload.status, event.payload.error);
        if (
          !shouldToastLspError({ status: event.payload.status, expected: event.payload.expected })
        ) {
          return;
        }
        const message = lspErrorMessage(event.payload.language, event.payload.error);
        // Each project folder starts its own server; one toast per failure is enough.
        if (!firstLspFailure(event.payload.language, message)) return;
        toast.error(message, {
          id: `lsp:${event.payload.language}:${message}`,
          action: isMissingTypeScript(event.payload.error)
            ? { label: "Install TypeScript", onClick: () => void installTypeScript() }
            : undefined,
        });
      });
    };

    void setup();

    return () => {
      void unlistenQuietly(unlisten);
    };
  }, [experimentalLsp]);
}
