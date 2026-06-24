import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toaster } from "@/shared/components/ui/sonner";
import { ThemeProvider } from "@/theme";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import "@/globals.css";
import { ExternalPanelApp } from "./ExternalPanelApp";

function getNodeId(): string | null {
  return new URLSearchParams(window.location.search).get("nodeId");
}

const nodeId = getNodeId();
const root = document.getElementById("floating-root");

if (!root) {
  throw new Error("floating-root element not found");
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <Toaster position="bottom-right" />
        {nodeId ? <ExternalPanelApp nodeId={nodeId} /> : <div>Missing nodeId</div>}
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

const showWindow = () => {
  getCurrentWindow()
    .show()
    .catch((err) => console.error("Failed to show external window:", err));
};

setTimeout(showWindow, 50);
setTimeout(showWindow, 500);
