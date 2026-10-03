/// Bridge methods for status bar items, keybindings, language providers, agent tools and terminals.

import type { BridgeContext } from "./bridge";
import { parseKeybinding } from "./keybindingParse";
import { asRecord, optionalString, requireParams, requireString, requireText } from "./params";
import {
  useExtensionsStore,
  type ContributionKind,
  type RegisteredAgentTool,
  type RegisteredKeybinding,
  type RegisteredLanguageProvider,
  type RegisteredStatusBarItem,
} from "./store";
import { createExtensionTerminal, sendExtensionTerminalText } from "./terminalApi";
import type { BridgeRequest } from "./types";

const MAX_STATUS_ITEMS = 10;
const MAX_KEYBINDINGS = 50;
const MAX_PROVIDERS = 20;
const MAX_TOOLS = 20;
const MAX_SCHEMA_CHARS = 16 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const LANGUAGE_PATTERN = /^(\*|[a-z0-9+#-]{1,32})$/;
export const TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function requireId(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!ID_PATTERN.test(value)) {
    throw new Error(`"${key}" must be 1-64 letters, numbers, ".", "_" or "-"`);
  }
  return value;
}

function itemsOf<K extends ContributionKind>(
  kind: K,
  extensionId: string,
): ReturnType<typeof useExtensionsStore.getState>[K] {
  const items = useExtensionsStore.getState()[kind];
  return items.filter((item) => item.extensionId === extensionId) as ReturnType<
    typeof useExtensionsStore.getState
  >[K];
}

/// Adds or replaces the item with the same key, enforcing a per-extension limit.
function upsert<T extends { extensionId: string }>(
  existing: T[],
  item: T,
  sameKey: (a: T, b: T) => boolean,
  limit: number,
  noun: string,
): T[] {
  const others = existing.filter((entry) => !sameKey(entry, item));
  if (others.length >= limit) {
    throw new Error(`An extension can register at most ${limit} ${noun}`);
  }
  return [...others, item];
}

function setStatusBarItem(ctx: BridgeContext, params: unknown): null {
  const record = requireParams(params);
  const alignment = record.alignment ?? "right";
  if (alignment !== "left" && alignment !== "right") {
    throw new Error('"alignment" must be "left" or "right"');
  }
  const item: RegisteredStatusBarItem = {
    extensionId: ctx.extensionId,
    id: requireId(record, "id"),
    text: requireString(record, "text").slice(0, 120),
    tooltip: optionalString(record, "tooltip", 500),
    command: record.command === undefined ? undefined : requireId(record, "command"),
    alignment,
  };
  const items = upsert(
    itemsOf("statusBarItems", ctx.extensionId),
    item,
    (a, b) => a.id === b.id,
    MAX_STATUS_ITEMS,
    "status bar items",
  );
  useExtensionsStore.getState().setContributionsFor("statusBarItems", ctx.extensionId, items);
  return null;
}

function removeStatusBarItem(ctx: BridgeContext, params: unknown): null {
  const id = requireString(requireParams(params), "id");
  const items = itemsOf("statusBarItems", ctx.extensionId).filter((item) => item.id !== id);
  useExtensionsStore.getState().setContributionsFor("statusBarItems", ctx.extensionId, items);
  return null;
}

export function validateKeybinding(
  extensionId: string,
  record: Record<string, unknown>,
): RegisteredKeybinding {
  const key = requireString(record, "key");
  const mac = optionalString(record, "mac", 64);
  if (!parseKeybinding(key, false) || (mac !== undefined && !parseKeybinding(mac, true))) {
    throw new Error(`Invalid key "${mac ?? key}"; use e.g. "ctrl+shift+k" with a modifier`);
  }
  return { extensionId, command: requireId(record, "command"), key, mac };
}

function registerKeybinding(ctx: BridgeContext, params: unknown): null {
  const binding = validateKeybinding(ctx.extensionId, requireParams(params));
  const items = upsert(
    itemsOf("keybindings", ctx.extensionId),
    binding,
    (a, b) => a.command === b.command,
    MAX_KEYBINDINGS,
    "keybindings",
  );
  useExtensionsStore.getState().setContributionsFor("keybindings", ctx.extensionId, items);
  return null;
}

function unregisterKeybinding(ctx: BridgeContext, params: unknown): null {
  const command = requireString(requireParams(params), "command");
  const items = itemsOf("keybindings", ctx.extensionId).filter((item) => item.command !== command);
  useExtensionsStore.getState().setContributionsFor("keybindings", ctx.extensionId, items);
  return null;
}

function registerProvider(
  ctx: BridgeContext,
  params: unknown,
  kind: "diagnosticsProviders" | "completionProviders",
): null {
  const record = requireParams(params);
  const language = requireString(record, "language");
  if (!LANGUAGE_PATTERN.test(language)) {
    throw new Error('"language" must be a Pragma language id such as "markdown", or "*"');
  }
  const triggers = record.triggerCharacters ?? [];
  if (
    !Array.isArray(triggers) ||
    triggers.length > 10 ||
    !triggers.every((value) => typeof value === "string" && value.length === 1)
  ) {
    throw new Error('"triggerCharacters" must be up to 10 single characters');
  }
  const provider: RegisteredLanguageProvider = {
    extensionId: ctx.extensionId,
    id: requireId(record, "id"),
    language,
    triggerCharacters: triggers as string[],
  };
  const items = upsert(
    itemsOf(kind, ctx.extensionId),
    provider,
    (a, b) => a.id === b.id,
    MAX_PROVIDERS,
    "providers of each kind",
  );
  useExtensionsStore.getState().setContributionsFor(kind, ctx.extensionId, items);
  return null;
}

function unregisterProvider(ctx: BridgeContext, params: unknown): null {
  const id = requireString(requireParams(params), "id");
  const store = useExtensionsStore.getState();
  for (const kind of ["diagnosticsProviders", "completionProviders"] as const) {
    const items = itemsOf(kind, ctx.extensionId).filter((item) => item.id !== id);
    store.setContributionsFor(kind, ctx.extensionId, items);
  }
  return null;
}

function registerTool(ctx: BridgeContext, params: unknown): null {
  const record = requireParams(params);
  const name = requireString(record, "name");
  if (!TOOL_NAME_PATTERN.test(name)) {
    throw new Error('"name" must be 1-40 letters, numbers, "_" or "-"');
  }
  const description = requireString(record, "description");
  if (description.length > 1024) throw new Error('"description" is too long');
  const schema = asRecord(record.inputSchema);
  if (!schema || schema.type !== "object") {
    throw new Error('"inputSchema" must be a JSON schema with type "object"');
  }
  if (JSON.stringify(schema).length > MAX_SCHEMA_CHARS) {
    throw new Error('"inputSchema" is too large');
  }
  if (record.readOnly !== undefined && typeof record.readOnly !== "boolean") {
    throw new Error('"readOnly" must be a boolean');
  }
  const tool: RegisteredAgentTool = {
    extensionId: ctx.extensionId,
    name,
    description,
    inputSchema: schema,
    readOnly: record.readOnly === true,
  };
  const items = upsert(
    itemsOf("agentTools", ctx.extensionId),
    tool,
    (a, b) => a.name === b.name,
    MAX_TOOLS,
    "agent tools",
  );
  useExtensionsStore.getState().setContributionsFor("agentTools", ctx.extensionId, items);
  return null;
}

function unregisterTool(ctx: BridgeContext, params: unknown): null {
  const name = requireString(requireParams(params), "name");
  const items = itemsOf("agentTools", ctx.extensionId).filter((item) => item.name !== name);
  useExtensionsStore.getState().setContributionsFor("agentTools", ctx.extensionId, items);
  return null;
}

function createTerminal(ctx: BridgeContext, params: unknown): { id: string } {
  const record = params === undefined ? {} : requireParams(params);
  return createExtensionTerminal(ctx.extensionId, ctx.workspaceRoot, {
    name: optionalString(record, "name", 60),
    cwd: optionalString(record, "cwd", 1024),
  });
}

async function sendTerminalText(ctx: BridgeContext, params: unknown): Promise<null> {
  const record = requireParams(params);
  if (record.addNewLine !== undefined && typeof record.addNewLine !== "boolean") {
    throw new Error('"addNewLine" must be a boolean');
  }
  await sendExtensionTerminalText(
    ctx.extensionId,
    requireString(record, "id"),
    requireText(record, "text"),
    record.addNewLine !== false,
  );
  return null;
}

export function handleContributionRequest(ctx: BridgeContext, request: BridgeRequest): unknown {
  switch (request.method) {
    case "statusBar.set":
      return setStatusBarItem(ctx, request.params);
    case "statusBar.remove":
      return removeStatusBarItem(ctx, request.params);
    case "keybindings.register":
      return registerKeybinding(ctx, request.params);
    case "keybindings.unregister":
      return unregisterKeybinding(ctx, request.params);
    case "languages.registerDiagnosticsProvider":
      return registerProvider(ctx, request.params, "diagnosticsProviders");
    case "languages.registerCompletionProvider":
      return registerProvider(ctx, request.params, "completionProviders");
    case "languages.unregisterProvider":
      return unregisterProvider(ctx, request.params);
    case "agent.registerTool":
      return registerTool(ctx, request.params);
    case "agent.unregisterTool":
      return unregisterTool(ctx, request.params);
    case "terminal.create":
      return createTerminal(ctx, request.params);
    case "terminal.sendText":
      return sendTerminalText(ctx, request.params);
    default:
      throw new Error(`Unknown method: ${request.method}`);
  }
}
