import type { AISettings, SettingsActions, SettingsState } from "./types";

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

export function mergeWithDefaults(
  persisted: unknown,
  defaults: SettingsState & SettingsActions,
): SettingsState & SettingsActions {
  if (!persisted || typeof persisted !== "object") {
    return { ...defaults };
  }

  const partial = persisted as Partial<SettingsState> & Record<string, unknown>;

  // Drop legacy persisted keys that have been removed from the settings schema.
  const { git: _, mcpRunningServerIds: _removedMcpRunningServerIds, ...restPartial } = partial;

  const migratedAi = migrateAISettings(partial.ai);

  return {
    ...defaults,
    ...restPartial,
    editor: mergePartial(defaults.editor, partial.editor),
    terminal: mergePartial(defaults.terminal, partial.terminal),
    ai: mergePartial(defaults.ai, migratedAi),
    layout: mergePartial(defaults.layout, partial.layout),
    workspace: mergePartial(defaults.workspace, partial.workspace),
    statusbar: mergePartial(defaults.statusbar, partial.statusbar),
    mcp: mergePartial(defaults.mcp, partial.mcp),
    lsp: mergePartial(defaults.lsp, partial.lsp),
    experimental: mergePartial(defaults.experimental, partial.experimental),
    agent: mergePartial(defaults.agent, partial.agent),
    customThemes: { ...defaults.customThemes, ...partial.customThemes },
    extensions: { ...defaults.extensions, ...partial.extensions },
    shortcuts: { ...defaults.shortcuts, ...partial.shortcuts },
  };
}
