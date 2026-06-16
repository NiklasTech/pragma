import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import App from "./app/App";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
