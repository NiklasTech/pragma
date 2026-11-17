import { describe, expect, it } from "vite-plus/test";

import { defaultSettings } from "@/shared/stores/settings/defaults";
import type { SettingsState } from "@/shared/stores/settings/types";

import { changedSettings, findSetting, isChanged, readSetting, resetPatch } from "./settingChanges";

function withEditor(patch: Partial<SettingsState["editor"]>): SettingsState {
  return { ...defaultSettings, editor: { ...defaultSettings.editor, ...patch } };
}

describe("settingChanges", () => {
  it("reads grouped and top-level values", () => {
    expect(readSetting(defaultSettings, "editor.fontSize")).toBe(defaultSettings.editor.fontSize);
    expect(readSetting(defaultSettings, "theme")).toBe(defaultSettings.theme);
  });

  it("finds the setting of a row by its label within an area", () => {
    expect(findSetting("Font Size", "editor")?.keys).toEqual(["editor.fontSize"]);
    expect(findSetting("Font Size", "agents")).toBeUndefined();
  });

  it("marks a setting as changed only when a value differs from the default", () => {
    const fontSize = findSetting("Font Size", "editor")!;
    expect(isChanged(fontSize, defaultSettings)).toBe(false);
    expect(isChanged(fontSize, withEditor({ fontSize: 99 }))).toBe(true);
  });

  it("lists the changed settings of an area", () => {
    const state = withEditor({ fontSize: 99 });
    expect(changedSettings(state, "editor").map((setting) => setting.id)).toContain(
      "editor-font-size",
    );
    expect(changedSettings(defaultSettings)).toEqual([]);
  });

  it("resets one value and keeps the rest of its group", () => {
    const state = withEditor({ fontSize: 99, tabSize: 8 });
    const patch = resetPatch(state, findSetting("Font Size", "editor")!);
    expect(patch.editor?.fontSize).toBe(defaultSettings.editor.fontSize);
    expect(patch.editor?.tabSize).toBe(8);
  });
});
