import { defaultSettings } from "@/shared/stores/settings/defaults";
import type { SettingsState } from "@/shared/stores/settings/types";

import type { Category } from "./components/settings-categories";
import { SETTINGS_SCHEMA, type SettingDefinition, type SettingKey } from "./schema";

type Bag = Record<string, unknown>;

function asBag(value: unknown): Bag {
  return typeof value === "object" && value !== null ? (value as Bag) : {};
}

/** The stored value behind `group.field` or a top-level setting name. */
export function readSetting(state: SettingsState, key: SettingKey): unknown {
  const [group, field] = key.split(".");
  const top = asBag(state)[group];
  return field === undefined ? top : asBag(top)[field];
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** True when any value of the setting differs from Pragma's default. */
export function isChanged(definition: SettingDefinition, state: SettingsState): boolean {
  return definition.keys.some(
    (key) => !sameValue(readSetting(state, key), readSetting(defaultSettings, key)),
  );
}

/** The setting a row shows: labels are unique within an area. */
export function findSetting(label: string, category: Category): SettingDefinition | undefined {
  return SETTINGS_SCHEMA.find(
    (definition) => definition.category === category && definition.label === label,
  );
}

/** Every setting that differs from its default, optionally within one area. */
export function changedSettings(state: SettingsState, category?: Category): SettingDefinition[] {
  return SETTINGS_SCHEMA.filter(
    (definition) =>
      (category === undefined || definition.category === category) && isChanged(definition, state),
  );
}

/** The state update that puts the setting's values back to their defaults. */
export function resetPatch(
  state: SettingsState,
  definition: SettingDefinition,
): Partial<SettingsState> {
  const patch: Bag = {};
  for (const key of definition.keys) {
    const [group, field] = key.split(".");
    const fallback = readSetting(defaultSettings, key);
    if (field === undefined) {
      patch[group] = fallback;
    } else {
      patch[group] = { ...asBag(asBag(state)[group]), ...asBag(patch[group]), [field]: fallback };
    }
  }
  return patch as Partial<SettingsState>;
}
