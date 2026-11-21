import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { error as logError } from "@tauri-apps/plugin-log";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./globals.css";
import App from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { ThemeProvider } from "./theme";
import { Toaster } from "@/shared/components/ui/sonner";
import { ExternalPanelApp } from "@/shell/external/ExternalPanelApp";
import { getFloatingContext } from "@/shared/lib/windowScope";
import { initRunConfigListeners } from "@/shared/stores/runConfig";
import { initDebugListeners } from "@/features/debug/client";
import { useFontStore } from "@/shared/stores/fonts";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

initRunConfigListeners();
initDebugListeners();
void useFontStore.getState().loadFonts();

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
  import.meta.hot.on("vite:beforeFullReload", (event) => {
    // Block full reloads during dev to preserve transient state (open files,
    // terminal sessions, chat history, etc.). The Vite Plus payload type does
    // not expose preventDefault(), so we fall back to throwing when a clean
    // cancellation is not available at runtime.
    const cancelable = event as Event;
    if (typeof cancelable.preventDefault === "function") {
      cancelable.preventDefault();
      return;
    }
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
  // WebKit reports this harmless layout notice while the window is resized, with no error object.
  if (event.message?.includes("ResizeObserver loop")) {
    event.preventDefault();
    return;
  }
  const detail = event.error ? formatErrorDetail(event.error) : event.message;
  if (detail.includes("Pragma: full-reload blocked")) {
    // This is an intentional dev-only guard, not a real runtime error.
    event.preventDefault();
    return;
  }
  void logError(`[global error] ${detail}`).catch(() => {});
  toast.error("An unexpected error occurred. Details were logged.");
});

window.addEventListener("unhandledrejection", (event) => {
  // WebKit rejects a cancelled CSS animation's finished promise with `true`.
  if (event.reason === true) {
    event.preventDefault();
    return;
  }
  const detail = formatErrorDetail(event.reason);
  void logError(`[unhandled rejection] ${detail}`).catch(() => {});
  toast.error("An unexpected error occurred. Details were logged.");
});

const floating = getFloatingContext();

function revealWindow(): void {
  if (!isTauri()) return;
  getCurrentWindow()
    .show()
    .catch((error) => {
      void logError(`[window] failed to show main window: ${formatErrorDetail(error)}`).catch(
        () => {},
      );
    });
}

/// Shows the hidden window as soon as React has committed the first screen.
function RevealOnCommit() {
  useEffect(() => revealWindow(), []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <RevealOnCommit />
      {floating.nodeId ? (
        <ThemeProvider>
          <Toaster position="bottom-right" />
          <ExternalPanelApp nodeId={floating.nodeId} />
        </ThemeProvider>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);

// Fallback when the first render fails; WebKit runs no rAF in a hidden window to wait on instead.
setTimeout(revealWindow, 400);
