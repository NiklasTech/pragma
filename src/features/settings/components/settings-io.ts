import { useSettingsStore } from "@/shared/stores/settings";
import { save, open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export async function exportSettings(): Promise<void> {
  const state = useSettingsStore.getState();
  const payload = JSON.stringify(
    {
      editor: state.editor,
      terminal: state.terminal,
      ai: state.ai,
      theme: state.theme,
      themeMode: state.themeMode,
      keymap: state.keymap,
      shortcuts: state.shortcuts,
      layout: state.layout,
      statusbar: state.statusbar,
      git: state.git,
      mcp: state.mcp,
    },
    null,
    2,
  );

  const path = await save({
    defaultPath: "pragma-settings.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!path) return;

  await writeTextFile(path, payload);
}

export async function importSettings(): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!selected || Array.isArray(selected)) return;

  const content = await readTextFile(selected);
  const parsed = JSON.parse(content) as unknown;

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid settings file");
  }

  useSettingsStore
    .getState()
    .importSettings(parsed as Partial<ReturnType<typeof useSettingsStore.getState>>);
}
