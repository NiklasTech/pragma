import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { lspErrorMessage, shouldToastLspError } from "@/shared/lib/lsp-servers";
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
        if (
          !shouldToastLspError({ status: event.payload.status, expected: event.payload.expected })
        ) {
          return;
        }
        const { language, project_root: root, error } = event.payload;
        // Every open editor listens, and each request retries the start: one toast per server.
        toast.error(lspErrorMessage(language, error), { id: `lsp:${language}:${root}` });
      });
    };

    void setup();

    return () => {
      void unlistenQuietly(unlisten);
    };
  }, [experimentalLsp]);
}
