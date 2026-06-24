import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { error as logError } from "@tauri-apps/plugin-log";
import "./globals.css";
import App from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { ExternalPanelEntry } from "./shell/external";
import { initRunConfigListeners } from "@/shared/stores/runConfig";

if (!isExternalPanel()) {
  initRunConfigListeners();
}

if (import.meta.env.DEV) {
  void (async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    (window as unknown as Record<string, unknown>).__pragma = {
      resetOnboarding: async () => {
        await invoke("set_onboarding_completed", { completed: false });
        location.reload();
      },
    };
  })();
}

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", () => {
    throw new Error("Pragma: full-reload blocked to preserve state");
  });
}

const originalError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  const msg = typeof first === "string" ? first : "";
  if (msg.includes("ResizeObserver loop") || msg.includes("ResizeObserver Loop")) {
    return;
  }
  originalError.apply(console, args);
};

function formatErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

window.addEventListener("error", (event) => {
  const detail = formatErrorDetail(event.error);
  void logError(`[global error] ${detail}`).catch(() => {});
  toast.error("An unexpected error occurred. Details were logged.");
});

window.addEventListener("unhandledrejection", (event) => {
  const detail = formatErrorDetail(event.reason);
  void logError(`[unhandled rejection] ${detail}`).catch(() => {});
  toast.error("An unexpected error occurred. Details were logged.");
});

function isExternalPanel(): boolean {
  return window.location.hash.startsWith("#/floating/");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>{isExternalPanel() ? <ExternalPanelEntry /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
