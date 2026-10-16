import { resolveThemeFile, type ThemeResolution } from "@/theme/themeFile";
import { lookupIn, type ThemeFolderEntry } from "@/theme/themeFolder";
import type { Theme, ThemeFile } from "@/theme/types";

export function parseThemeImport(content: string, known: Theme[]): ThemeResolution {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  return resolveThemeFile(parsed, lookupIn(known));
}

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A new theme file that extends `theme`, ready to edit in the themes folder. */
export function duplicateThemeFile(
  theme: Theme,
  takenIds: ReadonlySet<string>,
  takenFiles: ReadonlySet<string>,
): { id: string; fileName: string; content: string } {
  const taken = new Set([...takenIds, ...[...takenFiles].map((f) => f.replace(/\.json$/, ""))]);
  const id = uniqueId(`${theme.metadata.id}-copy`, taken);
  const file: ThemeFile = {
    format: "pragma-theme-v1",
    metadata: { id, name: `${theme.metadata.name} Copy` },
    extends: theme.metadata.id,
    tokens: {},
  };
  return { id, fileName: `${id}.json`, content: `${JSON.stringify(file, null, 2)}\n` };
}

/** Folder themes export their file as written; other themes export in full. */
export function exportThemeContent(theme: Theme, entry: ThemeFolderEntry | undefined): string {
  if (entry) return entry.content;
  const { format, metadata, appearance, tokens } = theme;
  return `${JSON.stringify({ format, metadata, appearance, tokens }, null, 2)}\n`;
}
