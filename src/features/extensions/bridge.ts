import { toast } from "sonner";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { validateTheme } from "@/theme/validateTheme";
import type { Theme, ThemeInput } from "@/theme/types";
import { useExtensionsStore, type RegisteredPanel } from "./store";
import {
  getActiveEditorSelection,
  getActiveEditorText,
  listWorkspace,
  readWorkspaceFile,
  setActiveEditorText,
  writeWorkspaceFile,
} from "./workspaceApi";
import type { BridgeRequest } from "./types";

export interface BridgeContext {
  extensionId: string;
  workspaceRoot: string | null;
  sendCommand: (commandId: string) => void;
}

export function parseBridgeRequest(data: unknown): BridgeRequest | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const msg = data as Record<string, unknown>;
  if (msg.kind !== "request") return null;
  if (typeof msg.id !== "number" || !Number.isInteger(msg.id)) return null;
  if (typeof msg.method !== "string" || msg.method.length === 0) return null;
  const request: BridgeRequest = { kind: "request", id: msg.id, method: msg.method };
  if ("params" in msg) {
    request.params = msg.params;
  }
  return request;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`"${key}" must be a non-empty string`);
  }
  return value;
}

function requireText(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`"${key}" must be a string`);
  }
  return value;
}

function requireWorkspaceRoot(ctx: BridgeContext): string {
  if (!ctx.workspaceRoot) {
    throw new Error("No workspace is open");
  }
  return ctx.workspaceRoot;
}

function requireParams(params: unknown): Record<string, unknown> {
  const record = asRecord(params);
  if (!record) throw new Error("params must be an object");
  return record;
}

export function prefixedCommandId(extensionId: string, commandId: string): string {
  return `ext:${extensionId}:${commandId}`;
}

export function prefixedThemeId(extensionId: string, themeId: string): string {
  return `ext:${extensionId}:${themeId}`;
}

function registerCommand(ctx: BridgeContext, params: unknown): null {
  const record = asRecord(params);
  if (!record) throw new Error("params must be an object");
  const commandId = requireString(record, "id");
  const title = requireString(record, "title");
  const category = typeof record.category === "string" ? record.category : "Extensions";

  useCommandPaletteStore.getState().registerCommand({
    id: prefixedCommandId(ctx.extensionId, commandId),
    label: title,
    category,
    action: () => ctx.sendCommand(commandId),
  });
  return null;
}

function unregisterCommand(ctx: BridgeContext, params: unknown): null {
  const record = asRecord(params);
  if (!record) throw new Error("params must be an object");
  const commandId = requireString(record, "id");
  useCommandPaletteStore
    .getState()
    .unregisterCommand(prefixedCommandId(ctx.extensionId, commandId));
  return null;
}

function registerTheme(ctx: BridgeContext, params: unknown): string {
  const record = asRecord(params);
  if (!record) throw new Error("theme must be an object");
  const result = validateTheme(record as ThemeInput);
  if (!result.valid) {
    throw new Error(`Invalid theme: ${result.errors.join("; ")}`);
  }
  const theme = record as unknown as Theme;
  const prefixed: Theme = {
    ...theme,
    metadata: { ...theme.metadata, id: prefixedThemeId(ctx.extensionId, theme.metadata.id) },
  };
  useSettingsStore.getState().addCustomTheme(prefixed);
  return prefixed.metadata.id;
}

function registerPanel(ctx: BridgeContext, params: unknown): null {
  const record = asRecord(params);
  if (!record) throw new Error("params must be an object");
  const panel: RegisteredPanel = {
    extensionId: ctx.extensionId,
    id: requireString(record, "id"),
    title: requireString(record, "title"),
  };
  if (record.icon !== undefined) {
    if (typeof record.icon !== "string") throw new Error('"icon" must be a string');
    panel.icon = record.icon;
  }
  if (record.html !== undefined) {
    if (typeof record.html !== "string") throw new Error('"html" must be a string');
    panel.html = record.html;
  }

  const { panels, setPanelsFor } = useExtensionsStore.getState();
  const existing = panels.filter((p) => p.extensionId === ctx.extensionId && p.id !== panel.id);
  setPanelsFor(ctx.extensionId, [...existing, panel]);
  return null;
}

function getSettings(ctx: BridgeContext): unknown {
  return useSettingsStore.getState().extensions[ctx.extensionId]?.settings ?? null;
}

function setSettings(ctx: BridgeContext, params: unknown): null {
  const record = asRecord(params);
  if (!record) throw new Error("params must be an object");
  try {
    JSON.stringify(record.value ?? null);
  } catch {
    throw new Error("settings value must be JSON-serializable");
  }
  useSettingsStore.getState().setExtensionSettings(ctx.extensionId, record.value ?? null);
  return null;
}

function showNotification(params: unknown): null {
  const record = asRecord(params);
  if (!record) throw new Error("params must be an object");
  const message = requireString(record, "message");
  switch (record.type) {
    case "error":
      toast.error(message);
      break;
    case "warning":
      toast.warning(message);
      break;
    case "success":
      toast.success(message);
      break;
    default:
      toast.info(message);
  }
  return null;
}

function getActiveFile(): unknown {
  const { tabs, activeTabId, cursorPositions } = useEditorStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab || tab.kind !== "file") return null;
  return {
    path: tab.path,
    name: tab.name,
    language: tab.language ?? null,
    cursor: cursorPositions[tab.id] ?? null,
  };
}

function workspaceReadFile(ctx: BridgeContext, params: unknown): Promise<unknown> {
  const record = requireParams(params);
  return readWorkspaceFile(requireWorkspaceRoot(ctx), requireString(record, "path"));
}

function workspaceWriteFile(ctx: BridgeContext, params: unknown): Promise<unknown> {
  const record = requireParams(params);
  return writeWorkspaceFile(
    requireWorkspaceRoot(ctx),
    requireString(record, "path"),
    requireText(record, "content"),
  );
}

function workspaceList(ctx: BridgeContext, params: unknown): Promise<unknown> {
  const record = params === undefined ? {} : requireParams(params);
  const path = record.path === undefined ? "." : requireString(record, "path");
  return listWorkspace(requireWorkspaceRoot(ctx), path);
}

function editorSetText(params: unknown): null {
  const record = requireParams(params);
  setActiveEditorText(requireText(record, "text"));
  return null;
}

export async function handleBridgeRequest(
  ctx: BridgeContext,
  request: BridgeRequest,
): Promise<unknown> {
  switch (request.method) {
    case "commands.register":
      return registerCommand(ctx, request.params);
    case "commands.unregister":
      return unregisterCommand(ctx, request.params);
    case "themes.register":
      return registerTheme(ctx, request.params);
    case "panels.register":
      return registerPanel(ctx, request.params);
    case "settings.get":
      return getSettings(ctx);
    case "settings.set":
      return setSettings(ctx, request.params);
    case "notifications.show":
      return showNotification(request.params);
    case "editor.getActiveFile":
      return getActiveFile();
    case "editor.getText":
      return getActiveEditorText();
    case "editor.setText":
      return editorSetText(request.params);
    case "editor.getSelection":
      return getActiveEditorSelection();
    case "workspace.readFile":
      return workspaceReadFile(ctx, request.params);
    case "workspace.writeFile":
      return workspaceWriteFile(ctx, request.params);
    case "workspace.list":
      return workspaceList(ctx, request.params);
    default:
      throw new Error(`Unknown method: ${request.method}`);
  }
}
