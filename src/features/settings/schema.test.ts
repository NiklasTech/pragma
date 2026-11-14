import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { defaultSettings } from "@/shared/stores/settings/defaults";
import type { WorkspaceEditorKey } from "@/shared/stores/workspaceSettings/types";
import { NOT_SETTINGS, OPEN_AUDIT, SETTINGS_SCHEMA, type SettingKey } from "./schema";

const GROUPS = new Set([
  "editor",
  "terminal",
  "ai",
  "workspace",
  "mcp",
  "lsp",
  "experimental",
  "agent",
  "notifications",
  "appearance",
  "repositoryColors",
]);

// Optional markers are missing from the defaults but still stored.
const OPTIONAL_KEYS = ["ai.migrationRevision", "mcp.migrationRevision"];

function storedKeys(): string[] {
  const keys = Object.entries(defaultSettings).flatMap(([name, value]) =>
    GROUPS.has(name) ? Object.keys(value as object).map((field) => `${name}.${field}`) : [name],
  );
  return [...new Set([...keys, ...OPTIONAL_KEYS])].sort();
}

const declared = SETTINGS_SCHEMA.flatMap((setting) => setting.keys);

// Typed so that a new project override fails to compile until it is listed here.
const PROJECT_EDITOR_KEYS: Record<WorkspaceEditorKey, true> = {
  tabSize: true,
  insertSpaces: true,
  formatOnSave: true,
  trimTrailingWhitespace: true,
  insertFinalNewline: true,
  rulers: true,
};
const PROJECT_KEYS: SettingKey[] = [
  ...Object.keys(PROJECT_EDITOR_KEYS).map((key) => `editor.${key}` as SettingKey),
  "agent.allowedCommands",
  "agent.stepLimit",
  "lsp.enabled",
];

describe("settings schema", () => {
  it("accounts for every stored value exactly once", () => {
    const accounted = [...declared, ...Object.keys(NOT_SETTINGS), ...Object.keys(OPEN_AUDIT)];
    expect([...accounted].sort()).toEqual(storedKeys());
  });

  it("uses unique ids", () => {
    const ids = SETTINGS_SCHEMA.map((setting) => setting.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names a source file that applies each setting", () => {
    const missing = SETTINGS_SCHEMA.flatMap((setting) => {
      const path = join(process.cwd(), setting.effect);
      if (!existsSync(path)) return [`${setting.id}: ${setting.effect} does not exist`];
      const source = readFileSync(path, "utf8");
      return setting.keys
        .map((key) => key.slice(key.lastIndexOf(".") + 1))
        .filter((field) => !new RegExp(`\\b${field}\\b`).test(source))
        .map((field) => `${setting.id}: ${setting.effect} never mentions ${field}`);
    });
    expect(missing).toEqual([]);
  });

  it("marks exactly the values a project can override as project scope", () => {
    const project = SETTINGS_SCHEMA.filter((setting) => setting.scope === "project")
      .flatMap((setting) => setting.keys)
      .sort();
    expect(project).toEqual([...PROJECT_KEYS].sort());
  });
});
