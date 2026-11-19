import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useLspRetryStore } from "@/shared/stores/lspRetry";

const TOAST_ID = "lsp:install-typescript";

/// Installs TypeScript and its language server globally, then starts it for the open files.
export async function installTypeScript(): Promise<void> {
  toast.loading("Installing TypeScript", { id: TOAST_ID });
  try {
    await invoke<string>("lsp_install_server", { language: "typescript" });
    toast.success("TypeScript installed", {
      id: TOAST_ID,
      description: "Language features start in the open files.",
    });
    useLspRetryStore.getState().retry();
  } catch (error) {
    toast.error(`TypeScript could not be installed: ${String(error)}`, { id: TOAST_ID });
  }
}
