import { beforeEach, describe, expect, it } from "vite-plus/test";
import { getDefaultShortcuts } from "@/shared/lib/shortcuts";
import { migrateAISettings, migrateMcpSettings, useSettingsStore } from "./settings";
import { mergeWithDefaults, migrateShortcuts } from "./settings/migrations";

describe("migrateAISettings", () => {
  const currentAI = useSettingsStore.getState().ai;

  it("hides model reasoning for profiles written before the revision marker", () => {
    const legacy = { ...currentAI, showThinking: true };
    delete legacy.migrationRevision;

    const migrated = migrateAISettings(legacy);

    expect(migrated?.showThinking).toBe(false);
    expect(migrated?.migrationRevision).toBe(1);
  });

  it("keeps an explicit choice made after the migration", () => {
    const migrated = migrateAISettings({
      ...currentAI,
      showThinking: true,
      migrationRevision: 1,
    });

    expect(migrated?.showThinking).toBe(true);
  });

  it("leaves profiles without providers untouched", () => {
    expect(migrateAISettings({ showThinking: true })).toEqual({ showThinking: true });
  });
});

describe("migrateMcpSettings", () => {
  const server = {
    id: "mcp-1",
    name: "GitHub",
    command: "npx",
    args: [],
    env: { GITHUB_TOKEN: "ghp_x", NODE_ENV: "production" },
    secretEnv: [],
    autostart: false,
  };

  it("drops secret-like values from profiles written before the revision marker", () => {
    const migrated = migrateMcpSettings({ servers: [server] });

    expect(migrated.servers[0]?.env).toEqual({ NODE_ENV: "production" });
    expect(migrated.servers[0]?.secretEnv).toEqual(["GITHUB_TOKEN"]);
    expect(migrated.migrationRevision).toBe(1);
  });

  it("keeps a value the user left in plain text after the migration", () => {
    const migrated = migrateMcpSettings({ servers: [server], migrationRevision: 1 });

    expect(migrated.servers[0]?.env.GITHUB_TOKEN).toBe("ghp_x");
  });
});

describe("settings extensions namespace", () => {
  beforeEach(() => {
    useSettingsStore.setState({ extensions: {} });
  });

  it("defaults to an empty record", () => {
    expect(useSettingsStore.getState().extensions).toEqual({});
  });

  it("toggles enabled without dropping stored settings", () => {
    const store = useSettingsStore.getState();
    store.setExtensionSettings("ext-a", { key: "value" });
    store.setExtensionEnabled("ext-a", false);

    expect(useSettingsStore.getState().extensions["ext-a"]).toEqual({
      enabled: false,
      settings: { key: "value" },
    });
  });

  it("writes settings without dropping the enabled flag", () => {
    const store = useSettingsStore.getState();
    store.setExtensionEnabled("ext-a", false);
    store.setExtensionSettings("ext-a", 42);

    expect(useSettingsStore.getState().extensions["ext-a"]).toEqual({
      enabled: false,
      settings: 42,
    });
  });

  it("merges extensions on importSettings", () => {
    const store = useSettingsStore.getState();
    store.setExtensionEnabled("ext-a", true);
    store.importSettings({
      extensions: { "ext-b": { enabled: false, settings: { imported: true } } },
    });

    const extensions = useSettingsStore.getState().extensions;
    expect(extensions["ext-a"]?.enabled).toBe(true);
    expect(extensions["ext-b"]).toEqual({ enabled: false, settings: { imported: true } });
  });
});

describe("migrateShortcuts", () => {
  const defaults = getDefaultShortcuts(false);

  it("moves a stored old Toggle Terminal default off Ctrl+Shift+T", () => {
    const migrated = migrateShortcuts(defaults, {
      "view.toggleTerminal": { ctrl: true, shift: true, code: "KeyT" },
    });
    expect(migrated["view.toggleTerminal"]).toEqual(defaults["view.toggleTerminal"]);
    expect(migrated["file.reopenClosedTab"]).toEqual({ ctrl: true, shift: true, code: "KeyT" });
  });

  it("keeps a custom Toggle Terminal binding", () => {
    const custom = { ctrl: true, alt: true, code: "KeyJ" };
    const migrated = migrateShortcuts(defaults, { "view.toggleTerminal": custom });
    expect(migrated["view.toggleTerminal"]).toEqual(custom);
  });

  it("moves stored previous Mac defaults to the new ones once", () => {
    const mac = getDefaultShortcuts(true);
    const migrated = migrateShortcuts(
      mac,
      {
        "view.toggleTerminal": { ctrl: true, code: "Backquote" },
        "search.replace": { meta: true, code: "KeyH" },
        "view.switchToEditor": null,
        "file.reopenClosedTab": mac["file.reopenClosedTab"],
      },
      0,
      true,
    );
    expect(migrated["view.toggleTerminal"]).toEqual({ meta: true, code: "KeyJ" });
    expect(migrated["search.replace"]).toEqual({ meta: true, alt: true, code: "KeyF" });
    expect(migrated["view.switchToEditor"]).toEqual({ meta: true, code: "Digit1" });
  });

  it("keeps custom bindings and bindings stored after the new defaults", () => {
    const mac = getDefaultShortcuts(true);
    const custom = { meta: true, alt: true, code: "KeyT" };
    const old = { ctrl: true, code: "Backquote" };
    const migrated = migrateShortcuts(mac, { "view.toggleTerminal": custom }, 0, true);
    expect(migrated["view.toggleTerminal"]).toEqual(custom);
    const current = migrateShortcuts(mac, { "view.toggleTerminal": old }, 1, true);
    expect(current["view.toggleTerminal"]).toEqual(old);
  });

  it("keeps an old default when another action uses the new one", () => {
    const mac = getDefaultShortcuts(true);
    const migrated = migrateShortcuts(
      mac,
      {
        "view.toggleTerminal": { ctrl: true, code: "Backquote" },
        "ai.toggle": { meta: true, code: "KeyJ" },
      },
      0,
      true,
    );
    expect(migrated["view.toggleTerminal"]).toEqual({ ctrl: true, code: "Backquote" });
  });

  it("leaves bindings alone once Reopen Closed Tab is stored", () => {
    const old = { ctrl: true, shift: true, code: "KeyT" };
    const migrated = migrateShortcuts(defaults, {
      "view.toggleTerminal": old,
      "file.reopenClosedTab": null,
    });
    expect(migrated["view.toggleTerminal"]).toEqual(old);
  });
});

describe("removed settings", () => {
  it("drops the unused layout and recent files but keeps the user's other values", () => {
    const stored = {
      layout: { sidebarWidth: 300, terminalHeight: "40%", chatPanelWidth: 420 },
      workspace: {
        recentFolders: ["/projects/pragma"],
        recentFiles: ["/projects/pragma/README.md"],
        favoriteFolders: ["/projects"],
      },
      editor: { fontSize: 16, formatOnSave: true },
      theme: "light-default",
    };

    const restored = mergeWithDefaults(stored, useSettingsStore.getState());

    expect(restored).not.toHaveProperty("layout");
    expect(restored.workspace).toEqual({
      recentFolders: ["/projects/pragma"],
      favoriteFolders: ["/projects"],
    });
    expect(restored.editor.fontSize).toBe(16);
    expect(restored.editor.formatOnSave).toBe(true);
    expect(restored.theme).toBe("light-default");
  });

  it("drops the statusbar and its session summary switch", () => {
    const restored = mergeWithDefaults(
      {
        statusbar: { visible: false, items: ["gitBranch"] },
        notifications: { statusSummary: false, playSound: false },
      },
      useSettingsStore.getState(),
    );

    expect(restored).not.toHaveProperty("statusbar");
    expect(restored.notifications).not.toHaveProperty("statusSummary");
    expect(restored.notifications.playSound).toBe(false);
  });

  it("drops the unread keymap, agent switch and AI terminal suggestion flag", () => {
    const restored = mergeWithDefaults(
      {
        keymap: "default",
        agent: { enabled: false, stepLimit: 25 },
        ai: { terminalSuggestions: false, inlineCompletion: false },
      },
      useSettingsStore.getState(),
    );

    expect(restored).not.toHaveProperty("keymap");
    expect(restored.agent).not.toHaveProperty("enabled");
    expect(restored.agent.stepLimit).toBe(25);
    expect(restored.ai).not.toHaveProperty("terminalSuggestions");
    expect(restored.ai.inlineCompletion).toBe(false);
  });
});
