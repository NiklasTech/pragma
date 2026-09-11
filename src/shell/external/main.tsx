import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toaster } from "@/shared/components/ui/sonner";
import { ThemeProvider } from "@/theme";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { getFloatingContext } from "@/shared/lib/windowScope";
import "@/globals.css";
import { ExternalPanelApp } from "./ExternalPanelApp";

const nodeId = getFloatingContext().nodeId;
const root = document.getElementById("floating-root");

if (!root) {
  throw new Error("floating-root element not found");
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <Toaster position="bottom-right" />
        <ExternalPanelApp nodeId={nodeId ?? ""} />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

const showWindow = () => {
  getCurrentWindow()
    .show()
    .catch(() => {});
};

setTimeout(showWindow, 50);
setTimeout(showWindow, 500);
