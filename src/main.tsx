import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { error as logError } from "@tauri-apps/plugin-log";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./globals.css";
import App from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { initRunConfigListeners } from "@/shared/stores/runConfig";
import { useFontStore } from "@/shared/stores/fonts";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

initRunConfigListeners();
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
  const detail = formatErrorDetail(event.error);
  if (detail.includes("Pragma: full-reload blocked")) {
    // This is an intentional dev-only guard, not a real runtime error.
    event.preventDefault();
    return;
  }
  void logError(`[global error] ${detail}`).catch(() => {});
  toast.error("An unexpected error occurred. Details were logged.");
});

window.addEventListener("unhandledrejection", (event) => {
  const detail = formatErrorDetail(event.reason);
  void logError(`[unhandled rejection] ${detail}`).catch(() => {});
  toast.error("An unexpected error occurred. Details were logged.");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if (isTauri()) {
  const appWindow = getCurrentWindow();
  // Wait for the first paint so the revealed window already shows content,
  // not a blank frame.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      appWindow.show().catch(() => {
        // If the window cannot be shown from the frontend, the OS/Tauri
        // window config remains the fallback. Failures are intentionally
        // swallowed to avoid an unhandled rejection on startup.
      });
    });
  });
}
