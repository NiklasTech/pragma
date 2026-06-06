import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App";
import { initRunConfigListeners } from "@/stores/runConfig";

initRunConfigListeners();

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", () => {
    throw new Error("Pragma: full-reload blocked to preserve state");
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
