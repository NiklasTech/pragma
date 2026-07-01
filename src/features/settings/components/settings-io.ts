import { useSettingsStore } from "@/shared/stores/settings";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

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

  await invoke("write_text_file", { path, content: payload });
}

export async function importSettings(): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!selected || Array.isArray(selected)) return;

  const result = await invoke<{ content: string }>("read_text_file", { path: selected });
  const content = result.content;
  const parsed = JSON.parse(content) as unknown;

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid settings file");
  }

  useSettingsStore
    .getState()
    .importSettings(parsed as Partial<ReturnType<typeof useSettingsStore.getState>>);
}
