import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { error as logError } from "@tauri-apps/plugin-log";
import "./globals.css";
import App from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { initRunConfigListeners } from "@/shared/stores/runConfig";

initRunConfigListeners();

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
