import { resolveThemeFile, type ThemeLookup, type ThemeResolution } from "./themeFile";
import type { Theme } from "./types";

export interface ThemeFileSource {
  fileName: string;
  content: string;
}

export interface ThemeFolderEntry extends ThemeFileSource {
  /** The last valid version; kept while the file has errors. */
  theme?: Theme;
  errors: string[];
}

export type ThemeFolderEntries = Record<string, ThemeFolderEntry>;

const SHOWN_ERRORS = 3;

export function themeErrorLines(errors: string[]): string[] {
  const shown = errors.slice(0, SHOWN_ERRORS);
  const hidden = errors.length - shown.length;
  return hidden > 0 ? [...shown, `and ${hidden} more`] : shown;
}

export function lookupIn(themes: Theme[]): ThemeLookup {
  return (id) => themes.find((theme) => theme.metadata.id === id) ?? `unknown theme "${id}"`;
}

function parse(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

function fileId(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const metadata = (raw as { metadata?: unknown }).metadata;
  if (metadata === null || typeof metadata !== "object") return undefined;
  const id = (metadata as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

/**
 * Resolves every file of the themes folder together, so files can extend each other.
 * `reservedIds` belong to built-in themes; `known` are the themes files may extend.
 */
export function loadThemeFolder(
  files: ThemeFileSource[],
  known: Theme[],
  reservedIds: ReadonlySet<string>,
  previous: ThemeFolderEntries,
): ThemeFolderEntries {
  const sorted = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName));
  const raw = new Map(sorted.map((file) => [file.fileName, parse(file.content)]));
  const fileById = new Map<string, string>();
  const idErrors = new Map<string, string>();

  for (const { fileName } of sorted) {
    const id = fileId(raw.get(fileName));
    if (id === undefined) continue;
    const owner = fileById.get(id);
    if (reservedIds.has(id)) {
      idErrors.set(fileName, `metadata.id: "${id}" is already used by a built-in theme`);
    } else if (owner) {
      idErrors.set(fileName, `metadata.id: "${id}" is already used by ${owner}`);
    } else {
      fileById.set(id, fileName);
    }
  }

  const results = new Map<string, ThemeResolution>();
  const knownLookup = lookupIn(known);

  const resolve = (fileName: string, stack: string[]): ThemeResolution => {
    const cached = results.get(fileName);
    if (cached) return cached;

    const content = raw.get(fileName);
    const idError = idErrors.get(fileName);
    let result: ThemeResolution;
    if (content === undefined) {
      result = { ok: false, errors: ["The file is not valid JSON."] };
    } else if (idError) {
      result = { ok: false, errors: [idError] };
    } else {
      result = resolveThemeFile(content, (id) => {
        const baseFile = fileById.get(id);
        if (!baseFile) return knownLookup(id);
        if (stack.includes(baseFile)) return `"${id}" extends itself through ${baseFile}`;
        const base = resolve(baseFile, [...stack, fileName]);
        if (base.ok) return base.theme;
        return previous[baseFile]?.theme ?? `theme "${id}" in ${baseFile} has errors`;
      });
    }
    results.set(fileName, result);
    return result;
  };

  const entries: ThemeFolderEntries = {};
  for (const file of sorted) {
    const result = resolve(file.fileName, []);
    entries[file.fileName] = result.ok
      ? { ...file, theme: result.theme, errors: [] }
      : { ...file, theme: previous[file.fileName]?.theme, errors: result.errors };
  }
  return entries;
}
