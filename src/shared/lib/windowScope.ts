import { getCurrentWindow } from "@tauri-apps/api/window";

function getWindowLabel(): string | null {
  try {
    return getCurrentWindow().label;
  } catch {
    return null;
  }
}

export interface FloatingWindowContext {
  nodeId: string | null;
  parent: string;
}

function paramsFrom(source: string): URLSearchParams {
  return new URLSearchParams(source.replace(/^[?#]/, ""));
}

/// Reads nodeId/parent for a floating OS window. Windows WebView2 often drops
/// `location.search` on `WebviewUrl::App`, so we prefer the init script, then hash.
export function getFloatingContext(): FloatingWindowContext {
  const injected = (globalThis as { __PRAGMA_FLOATING__?: { nodeId?: string; parent?: string } })
    .__PRAGMA_FLOATING__;
  if (injected?.nodeId) {
    return { nodeId: injected.nodeId, parent: injected.parent?.trim() || "main" };
  }

  const hash = paramsFrom(globalThis.location?.hash ?? "");
  const hashNodeId = hash.get("nodeId");
  if (hashNodeId) {
    return { nodeId: hashNodeId, parent: hash.get("parent")?.trim() || "main" };
  }

  const search = paramsFrom(globalThis.location?.search ?? "");
  return {
    nodeId: search.get("nodeId"),
    parent: search.get("parent")?.trim() || "main",
  };
}

/// Identifies the workspace a window belongs to: the window's own label for
/// workspace windows, the creating window's label for floating windows.
export function getWindowScope(): string {
  const label = getWindowLabel();
  if (label === null) return "main";
  if (!label.startsWith("floating-")) return label;
  return getFloatingContext().parent;
}

/// True for windows that host a full workspace (main and workspace-N),
/// false for floating panel windows and non-Tauri environments.
export function isWorkspaceWindow(): boolean {
  const label = getWindowLabel();
  return label === "main" || (label !== null && label.startsWith("workspace-"));
}
