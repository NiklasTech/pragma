import { invoke } from "@tauri-apps/api/core";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useSettingsStore } from "@/shared/stores/settings";
import { validateTheme } from "@/theme/validateTheme";
import type { Theme, ThemeInput } from "@/theme/types";
import {
  handleBridgeRequest,
  parseBridgeRequest,
  prefixedCommandId,
  prefixedThemeId,
} from "./bridge";
import { validateExtensionManifest } from "./manifest";
import { buildExtensionSrcDoc } from "./sdkBootstrap";
import { useExtensionsStore, type RegisteredPanel } from "./store";
import type { BridgeResponse, ExtensionManifest, ExtensionSummary } from "./types";

const running = new Map<string, HTMLIFrameElement>();
let listenerInstalled = false;

function sendEvent(extensionId: string, event: string, data?: unknown): void {
  const iframe = running.get(extensionId);
  iframe?.contentWindow?.postMessage({ kind: "event", event, data }, "*");
}

function sendResponse(extensionId: string, response: BridgeResponse): void {
  const iframe = running.get(extensionId);
  iframe?.contentWindow?.postMessage(response, "*");
}

function findExtensionBySource(source: MessageEventSource | null): string | null {
  for (const [id, iframe] of running) {
    if (iframe.contentWindow === source) return id;
  }
  return null;
}

function onMessage(event: MessageEvent): void {
  const extensionId = findExtensionBySource(event.source);
  if (!extensionId) return;

  const request = parseBridgeRequest(event.data);
  if (!request) return;

  const ctx = {
    extensionId,
    sendCommand: (commandId: string) => sendEvent(extensionId, "command", { commandId }),
  };

  handleBridgeRequest(ctx, request)
    .then((result) => {
      sendResponse(extensionId, { kind: "response", id: request.id, ok: true, result });
    })
    .catch((err: unknown) => {
      sendResponse(extensionId, {
        kind: "response",
        id: request.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

function ensureListener(): void {
  if (listenerInstalled || typeof window === "undefined") return;
  window.addEventListener("message", onMessage);
  listenerInstalled = true;
}

function isEnabled(extensionId: string): boolean {
  return useSettingsStore.getState().extensions[extensionId]?.enabled ?? true;
}

async function registerManifestThemes(
  workspaceRoot: string,
  manifest: ExtensionManifest,
): Promise<void> {
  const themes = manifest.contributes?.themes;
  if (!themes) return;

  const settings = useSettingsStore.getState();
  for (const entry of themes) {
    let raw: unknown = entry;
    if (typeof entry === "object" && entry !== null && "path" in entry) {
      const path = (entry as { path: unknown }).path;
      if (typeof path !== "string") {
        throw new Error('contributes.themes: "path" must be a string');
      }
      const content = await invoke<string>("extension_read_asset", {
        workspaceRoot,
        extensionId: manifest.id,
        assetPath: path,
      });
      raw = JSON.parse(content) as unknown;
    }

    const result = validateTheme(raw as ThemeInput);
    if (!result.valid) {
      throw new Error(`Invalid theme: ${result.errors.join("; ")}`);
    }
    const theme = raw as Theme;
    settings.addCustomTheme({
      ...theme,
      metadata: {
        ...theme.metadata,
        id: prefixedThemeId(manifest.id, theme.metadata.id),
      },
    });
  }
}

function registerManifestContributions(manifest: ExtensionManifest): void {
  const commands = manifest.contributes?.commands ?? [];
  const palette = useCommandPaletteStore.getState();
  for (const command of commands) {
    palette.registerCommand({
      id: prefixedCommandId(manifest.id, command.id),
      label: command.title,
      category: command.category ?? "Extensions",
      action: () => sendEvent(manifest.id, "command", { commandId: command.id }),
    });
  }

  const panels: RegisteredPanel[] = (manifest.contributes?.panels ?? []).map((panel) => ({
    extensionId: manifest.id,
    id: panel.id,
    title: panel.title,
    icon: panel.icon,
    html: panel.html,
  }));
  if (panels.length > 0) {
    useExtensionsStore.getState().setPanelsFor(manifest.id, panels);
  }
}

function unregisterExtensionContributions(extensionId: string): void {
  const prefix = `ext:${extensionId}:`;
  const palette = useCommandPaletteStore.getState();
  for (const command of palette.commands) {
    if (command.id.startsWith(prefix)) {
      palette.unregisterCommand(command.id);
    }
  }
  useExtensionsStore.getState().setPanelsFor(extensionId, []);
}

export function stopExtension(extensionId: string): void {
  const iframe = running.get(extensionId);
  if (iframe) {
    iframe.remove();
    running.delete(extensionId);
  }
  unregisterExtensionContributions(extensionId);
}

export function stopAllExtensions(): void {
  for (const id of running.keys()) {
    stopExtension(id);
  }
}

export async function startExtension(
  workspaceRoot: string,
  summary: ExtensionSummary,
): Promise<void> {
  stopExtension(summary.id);
  const { setStatus } = useExtensionsStore.getState();

  try {
    if (summary.error) {
      throw new Error(summary.error);
    }
    const parsed = validateExtensionManifest(summary.manifest);
    if (!parsed.valid || !parsed.manifest) {
      throw new Error(parsed.errors.join("; "));
    }
    const manifest = parsed.manifest;

    await registerManifestThemes(workspaceRoot, manifest);

    const mainSource = await invoke<string>("extension_read_main", {
      workspaceRoot,
      extensionId: manifest.id,
    });

    ensureListener();
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.display = "none";
    iframe.srcdoc = buildExtensionSrcDoc(mainSource);
    document.body.appendChild(iframe);
    running.set(manifest.id, iframe);

    registerManifestContributions(manifest);
    setStatus(manifest.id, { status: "running" });
  } catch (err) {
    stopExtension(summary.id);
    setStatus(summary.id, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function loadWorkspaceExtensions(workspaceRoot: string): Promise<void> {
  const store = useExtensionsStore.getState();
  stopAllExtensions();
  store.reset();
  store.setWorkspaceRoot(workspaceRoot);

  let summaries: ExtensionSummary[];
  try {
    summaries = await invoke<ExtensionSummary[]>("extension_list", { workspaceRoot });
  } catch (err) {
    store.setSummaries([
      {
        id: "__load-error__",
        name: "Extensions",
        version: "",
        description: null,
        path: "",
        manifest: null,
        error: err instanceof Error ? err.message : String(err),
      },
    ]);
    return;
  }

  store.setSummaries(summaries);
  for (const summary of summaries) {
    if (summary.error) {
      store.setStatus(summary.id, { status: "error", error: summary.error });
      continue;
    }
    if (!isEnabled(summary.id)) {
      store.setStatus(summary.id, { status: "disabled" });
      continue;
    }
    await startExtension(workspaceRoot, summary);
  }
}

export async function setExtensionRunning(
  workspaceRoot: string,
  extensionId: string,
  enabled: boolean,
): Promise<void> {
  useSettingsStore.getState().setExtensionEnabled(extensionId, enabled);
  const store = useExtensionsStore.getState();
  if (!enabled) {
    stopExtension(extensionId);
    store.setStatus(extensionId, { status: "disabled" });
    return;
  }
  const summary = store.summaries.find((s) => s.id === extensionId);
  if (summary) {
    await startExtension(workspaceRoot, summary);
  }
}

export async function installExtensionFromPath(
  workspaceRoot: string,
  sourcePath: string,
): Promise<void> {
  await invoke("extension_install_from_path", { workspaceRoot, sourcePath });
  await loadWorkspaceExtensions(workspaceRoot);
}

export async function removeExtension(workspaceRoot: string, extensionId: string): Promise<void> {
  stopExtension(extensionId);
  await invoke("extension_remove", { workspaceRoot, extensionId });
  await loadWorkspaceExtensions(workspaceRoot);
}
