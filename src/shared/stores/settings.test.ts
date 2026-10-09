import { beforeEach, describe, expect, it } from "vite-plus/test";
import { getDefaultShortcuts } from "@/shared/lib/shortcuts";
import { migrateAISettings, migrateMcpSettings, useSettingsStore } from "./settings";
import { migrateShortcuts } from "./settings/migrations";

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

  it("leaves bindings alone once Reopen Closed Tab is stored", () => {
    const old = { ctrl: true, shift: true, code: "KeyT" };
    const migrated = migrateShortcuts(defaults, {
      "view.toggleTerminal": old,
      "file.reopenClosedTab": null,
    });
    expect(migrated["view.toggleTerminal"]).toEqual(old);
  });
});
