import { getCurrentWindow } from "@tauri-apps/api/window";

function getWindowLabel(): string | null {
  try {
    return getCurrentWindow().label;
  } catch {
    return null;
  }
}

/// Identifies the workspace a window belongs to: the window's own label for
/// workspace windows, the creating window's label for floating windows.
export function getWindowScope(): string {
  const label = getWindowLabel();
  if (label === null) return "main";
  if (!label.startsWith("floating-")) return label;

  const search = globalThis.location?.search ?? "";
  return new URLSearchParams(search).get("parent") ?? "main";
}

/// True for windows that host a full workspace (main and workspace-N),
/// false for floating panel windows and non-Tauri environments.
export function isWorkspaceWindow(): boolean {
  const label = getWindowLabel();
  return label === "main" || (label !== null && label.startsWith("workspace-"));
}
