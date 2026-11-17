import { extractSecretLikeEnv, withoutSecretValues } from "@/shared/lib/mcpSecretEnv";
import {
  findConflictingAction,
  getIsMac,
  isConflict,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutMap,
} from "@/shared/lib/shortcuts";
import { THEMES_REVISION, migrateRetiredThemes } from "./themeMigration";
import type {
  AISettings,
  McpSettings,
  NotificationSettings,
  SettingsActions,
  SettingsState,
} from "./types";

export function mergePartial<T extends object>(defaults: T, partial?: Partial<T> | null): T {
  if (!partial || typeof partial !== "object") {
    return { ...defaults };
  }

  const result = { ...defaults };
  for (const [key, value] of Object.entries(partial)) {
    const defaultValue = result[key as keyof T];
    if (Array.isArray(value)) {
      result[key as keyof T] = value as T[keyof T];
    } else if (
      value &&
      typeof value === "object" &&
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      result[key as keyof T] = mergePartial(
        defaultValue as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

const OLD_MOONSHOT_MODELS = new Set(["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]);

const AI_DEFAULTS_REVISION = 1;

export function migrateAISettings(
  ai: Partial<AISettings> | undefined,
): Partial<AISettings> | undefined {
  if (!ai || !ai.providers) return ai;

  const providers = { ...ai.providers };
  const kimi = providers.kimi;
  let defaultModel = ai.defaultModel;

  if (
    kimi &&
    (OLD_MOONSHOT_MODELS.has(kimi.model ?? "") || kimi.baseUrl === "https://api.moonshot.cn/v1")
  ) {
    providers.kimi = {
      ...kimi,
      baseUrl: "https://api.kimi.com/coding/v1",
      model: "",
    };
  }

  if (ai.defaultProvider === "kimi" && OLD_MOONSHOT_MODELS.has(defaultModel ?? "")) {
    defaultModel = "";
  }

  const updated: Partial<AISettings> = { ...ai, providers };
  if (defaultModel !== ai.defaultModel) {
    updated.defaultModel = defaultModel;
  }

  // Revision 1 hides the model reasoning by default; a later explicit toggle is kept.
  if ((ai.migrationRevision ?? 0) < AI_DEFAULTS_REVISION) {
    updated.showThinking = false;
    updated.migrationRevision = AI_DEFAULTS_REVISION;
  }
  return updated;
}

const MCP_SECRETS_REVISION = 1;

export function migrateMcpSettings(mcp: McpSettings): McpSettings {
  // Revision 1 moves secret-like env values to the keychain; the backend migrates mcp.json.
  const migrate = (mcp.migrationRevision ?? 0) < MCP_SECRETS_REVISION;
  return {
    ...mcp,
    servers: mcp.servers.map((server) =>
      migrate ? extractSecretLikeEnv(server).server : withoutSecretValues(server),
    ),
    migrationRevision: MCP_SECRETS_REVISION,
  };
}

export const SHORTCUTS_REVISION = 2;

/// Defaults that a revision replaced: [action, default before that revision, revision].
const PREVIOUS_SHORTCUT_DEFAULTS: Array<
  [ShortcutActionId, (isMac: boolean) => ShortcutBinding | null, number]
> = [
  ["view.toggleTerminal", () => ({ ctrl: true, code: "Backquote" }), 1],
  ["search.replace", (isMac) => ({ [isMac ? "meta" : "ctrl"]: true, code: "KeyH" }), 1],
  // Cmd/Ctrl+1 to 9 now pick the tab with that number.
  ["view.switchToAgents", (isMac) => ({ [isMac ? "meta" : "ctrl"]: true, code: "Digit2" }), 2],
  ["view.switchToEditor", (isMac) => ({ [isMac ? "meta" : "ctrl"]: true, code: "Digit1" }), 2],
];

function isSameBinding(a: ShortcutBinding | null | undefined, b: ShortcutBinding | null): boolean {
  return a && b ? isConflict(a, b) : !a && !b;
}

/// Cmd/Ctrl+Shift+T moved from Toggle Terminal to Reopen Closed Tab; a stored old default must not shadow it.
/// A stored previous default takes the new one once, unless another action already uses it.
export function migrateShortcuts(
  defaults: ShortcutMap,
  persisted: Partial<ShortcutMap> | undefined,
  revision = 0,
  isMac = getIsMac(),
): ShortcutMap {
  const merged = { ...defaults, ...persisted };
  if (
    persisted &&
    !("file.reopenClosedTab" in persisted) &&
    isConflict(persisted["view.toggleTerminal"], defaults["file.reopenClosedTab"])
  ) {
    merged["view.toggleTerminal"] = defaults["view.toggleTerminal"];
  }
  if (!persisted || revision >= SHORTCUTS_REVISION) return merged;
  for (const [id, previous, since] of PREVIOUS_SHORTCUT_DEFAULTS) {
    if (revision >= since) continue;
    if (!(id in persisted) || !isSameBinding(persisted[id], previous(isMac))) continue;
    if (findConflictingAction(id, defaults[id], merged)) continue;
    merged[id] = defaults[id];
  }
  return merged;
}

// Stored once but never read; older settings still carry them.
const REMOVED_KEYS = {
  workspace: ["recentFiles"],
  ai: ["terminalSuggestions"],
  agent: ["enabled"],
  notifications: ["statusSummary", "approvalNeeded", "badge", "inAppPopups", "playSound"],
  appearance: ["accentColor"],
} as const;

/** Carries the old popup and sound switches over to the card and sound of the new three ways. */
export function migrateNotificationSettings(
  partial: unknown,
): Partial<NotificationSettings> | undefined {
  if (!partial || typeof partial !== "object") return undefined;
  const legacy = partial as Partial<NotificationSettings> & {
    inAppPopups?: unknown;
    playSound?: unknown;
  };
  const migrated: Partial<NotificationSettings> = { ...legacy };
  if (legacy.card === undefined && typeof legacy.inAppPopups === "boolean") {
    migrated.card = legacy.inAppPopups;
  }
  if (legacy.sound === undefined && typeof legacy.playSound === "boolean") {
    migrated.sound = legacy.playSound;
  }
  return migrated;
}

export function withoutRemovedKeys<T extends object>(
  group: keyof typeof REMOVED_KEYS,
  value: T,
): T {
  const result: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of REMOVED_KEYS[group]) delete result[key];
  return result as T;
}

export function mergeWithDefaults(
  persisted: unknown,
  defaults: SettingsState & SettingsActions,
): SettingsState & SettingsActions {
  if (!persisted || typeof persisted !== "object") {
    return { ...defaults };
  }

  const partial = persisted as Partial<SettingsState> & Record<string, unknown>;

  // Drop legacy persisted keys that have been removed from the settings schema.
  const {
    git: _,
    mcpRunningServerIds: _removedMcpRunningServerIds,
    themeMode: _removedThemeMode,
    layout: _removedLayout,
    keymap: _removedKeymap,
    statusbar: _removedStatusbar,
    ...restPartial
  } = partial;

  const migratedAi = migrateAISettings(partial.ai);
  const themes = migrateRetiredThemes(
    {
      theme: partial.theme ?? defaults.theme,
      lightTheme: partial.lightTheme ?? defaults.lightTheme,
      darkTheme: partial.darkTheme ?? defaults.darkTheme,
      editor: mergePartial(defaults.editor, partial.editor),
      terminal: mergePartial(defaults.terminal, partial.terminal),
    },
    partial.themesRevision,
  );

  return {
    ...defaults,
    ...restPartial,
    ...themes,
    ai: withoutRemovedKeys("ai", mergePartial(defaults.ai, migratedAi)),
    workspace: withoutRemovedKeys("workspace", mergePartial(defaults.workspace, partial.workspace)),
    mcp: migrateMcpSettings(mergePartial(defaults.mcp, partial.mcp)),
    lsp: mergePartial(defaults.lsp, partial.lsp),
    // CLIs are core now; the old experimental switch could have left them off.
    experimental: { ...mergePartial(defaults.experimental, partial.experimental), acp: true },
    agent: withoutRemovedKeys("agent", mergePartial(defaults.agent, partial.agent)),
    notifications: withoutRemovedKeys(
      "notifications",
      mergePartial(defaults.notifications, migrateNotificationSettings(partial.notifications)),
    ),
    appearance: withoutRemovedKeys(
      "appearance",
      mergePartial(defaults.appearance, partial.appearance),
    ),
    repositoryColors: mergePartial(defaults.repositoryColors, partial.repositoryColors),
    customThemes: { ...defaults.customThemes, ...partial.customThemes },
    extensions: { ...defaults.extensions, ...partial.extensions },
    shortcuts: migrateShortcuts(defaults.shortcuts, partial.shortcuts, partial.shortcutsRevision),
    shortcutsRevision: SHORTCUTS_REVISION,
    themesRevision: THEMES_REVISION,
  };
}
