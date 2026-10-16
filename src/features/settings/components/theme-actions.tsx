import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { themeErrorLines } from "@/theme/themeFolder";
import {
  folderEntryForTheme,
  folderThemes,
  reloadThemeFolder,
  useThemeFolderStore,
} from "@/theme/themeFolderStore";
import type { Theme } from "@/theme/types";
import { duplicateThemeFile, exportThemeContent, parseThemeImport } from "./theme-import";

function showErrors(title: string, errors: string[]): void {
  toast.error(title, {
    description: (
      <div className="flex flex-col gap-0.5">
        {themeErrorLines(errors).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    ),
  });
}

/** Copies a theme file into the themes folder; resolves to the imported theme id. */
export async function importTheme(available: Theme[]): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!selected || Array.isArray(selected)) return null;

  let content: string;
  try {
    content = (await invoke<{ content: string }>("read_text_file", { path: selected })).content;
  } catch (err) {
    toast.error("Could not read the theme file", { description: String(err) });
    return null;
  }

  const result = parseThemeImport(content, available);
  if (!result.ok) {
    showErrors("Could not import the theme", result.errors);
    return null;
  }

  const id = result.theme.metadata.id;
  const entries = useThemeFolderStore.getState().entries;
  const fileName = folderEntryForTheme(entries, id)?.fileName ?? `${id}.json`;
  try {
    await invoke("theme_files_write", { fileName, content });
    await reloadThemeFolder();
  } catch (err) {
    toast.error("Could not save the theme", { description: String(err) });
    return null;
  }
  return id;
}

/** Creates a theme file that extends `theme`; resolves to the new theme id. */
export async function duplicateTheme(theme: Theme, available: Theme[]): Promise<string | null> {
  const entries = useThemeFolderStore.getState().entries;
  const copy = duplicateThemeFile(
    theme,
    new Set(available.map((t) => t.metadata.id)),
    new Set(Object.keys(entries)),
  );
  try {
    await invoke("theme_files_write", { fileName: copy.fileName, content: copy.content });
    await reloadThemeFolder();
  } catch (err) {
    toast.error("Could not duplicate the theme", { description: String(err) });
    return null;
  }
  const created = folderThemes(useThemeFolderStore.getState().entries).some(
    (t) => t.metadata.id === copy.id,
  );
  if (created) toast.success(`Created ${copy.fileName} in the themes folder.`);
  return created ? copy.id : null;
}

export async function exportTheme(theme: Theme): Promise<void> {
  const path = await save({
    defaultPath: `${theme.metadata.id}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return;
  const entry = folderEntryForTheme(useThemeFolderStore.getState().entries, theme.metadata.id);
  try {
    await invoke("write_text_file", { path, content: exportThemeContent(theme, entry) });
  } catch (err) {
    toast.error("Could not export the theme", { description: String(err) });
  }
}

/** Deletes the theme's file from the themes folder; false when it is not a folder theme. */
export async function deleteFolderTheme(theme: Theme): Promise<boolean> {
  const entry = folderEntryForTheme(useThemeFolderStore.getState().entries, theme.metadata.id);
  if (!entry) return false;
  try {
    await invoke("theme_files_delete", { fileName: entry.fileName });
    await reloadThemeFolder();
  } catch (err) {
    toast.error("Could not delete the theme", { description: String(err) });
  }
  return true;
}

export function openThemesFolder(): void {
  invoke("theme_files_open_folder").catch((err: unknown) => {
    toast.error("Could not open the themes folder", { description: String(err) });
  });
}
