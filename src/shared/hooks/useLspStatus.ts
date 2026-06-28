import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";

interface LspStatusEvent {
  language: string;
  project_root: string;
  status: "stopped" | "starting" | "running" | "error";
  error?: string;
}

export function useLspStatus() {
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<LspStatusEvent>("lsp_status_changed", (event) => {
        if (event.payload.status === "error") {
          const message = event.payload.error ?? `${event.payload.language} language server failed`;
          toast.error(message);
        }
      });
    };

    void setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);
}
