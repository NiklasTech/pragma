import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toaster } from "@/shared/components/ui/sonner";
import { ThemeProvider } from "@/theme";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import "@/globals.css";
import { ExternalPanelApp } from "./ExternalPanelApp";

// eslint-disable-next-line no-console
console.log("[external/main] script started", window.location.href);

function getNodeId(): string | null {
  return new URLSearchParams(window.location.search).get("nodeId");
}

const nodeId = getNodeId();
// eslint-disable-next-line no-console
console.log("[external/main] nodeId", nodeId);

const root = document.getElementById("floating-root");
// eslint-disable-next-line no-console
console.log("[external/main] root element", root);

if (!root) {
  throw new Error("floating-root element not found");
}

try {
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
  // eslint-disable-next-line no-console
  console.log("[external/main] render called");
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("[external/main] render failed", err);
  throw err;
}

const showWindow = () => {
  getCurrentWindow()
    .show()
    .catch((err) => console.error("Failed to show external window:", err));
};

setTimeout(showWindow, 50);
setTimeout(showWindow, 500);
