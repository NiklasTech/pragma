import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { lspWorkspaceSymbol, type LspWorkspaceSymbolItem } from "@/features/editor/lsp/client";
import type { SearchResult, SearchWorkspaceResult } from "@/features/sidebar/lib/searchReplace";
import { useGoToFileStore, type GoToFileEntry } from "@/shared/stores/goToFile";

import { toGoToFileEntry } from "../goToFileSearch";
import { activeLspContext } from "../useLspSymbolCommands";

const SYMBOL_DELAY_MS = 120;
const TEXT_DELAY_MS = 220;
const MIN_TEXT_LENGTH = 3;

/// The best files for the text, ranked in the backend so typing never waits for the whole list.
export function useGoToFiles(
  text: string,
  enabled: boolean,
  rootPath: string | null,
  limit: number,
): GoToFileEntry[] {
  const listing = useGoToFileStore((state) => state.listing);
  const [result, setResult] = useState<{ root: string; files: GoToFileEntry[] } | null>(null);
  useEffect(() => {
    if (!enabled || !rootPath) return;
    let live = true;
    invoke<string[]>("quick_open_search", { workspaceRoot: rootPath, query: text, limit })
      .then((found) => {
        if (live)
          setResult({
            root: rootPath,
            files: found.map((path) => toGoToFileEntry(rootPath, path)),
          });
      })
      .catch(() => live && setResult({ root: rootPath, files: [] }));
    return () => {
      live = false;
    };
  }, [enabled, rootPath, text, limit, listing]);
  return enabled && result?.root === rootPath ? result.files : [];
}

/// Workspace symbols from the language server of the open file; empty without one.
export function useGoToSymbols(text: string, enabled: boolean): LspWorkspaceSymbolItem[] {
  const [result, setResult] = useState<{ text: string; items: LspWorkspaceSymbolItem[] }>({
    text: "",
    items: [],
  });
  useEffect(() => {
    const context = activeLspContext();
    if (!enabled || !text || !context) return;
    let live = true;
    const timer = window.setTimeout(() => {
      lspWorkspaceSymbol(context.language, context.filePath, text)
        .then((items) => live && setResult({ text, items }))
        .catch(() => live && setResult({ text, items: [] }));
    }, SYMBOL_DELAY_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [text, enabled]);
  return enabled && result.text === text ? result.items : [];
}

/// The first matches of the text across the folder, once it is long enough to be worth a search.
export function useGoToText(
  text: string,
  enabled: boolean,
  rootPath: string | null,
): { matches: SearchResult[]; searching: boolean } {
  const [result, setResult] = useState<{ text: string; matches: SearchResult[] }>({
    text: "",
    matches: [],
  });
  const active = enabled && rootPath !== null && text.length >= MIN_TEXT_LENGTH;
  useEffect(() => {
    if (!active || !rootPath) return;
    let live = true;
    let searchId: string | null = null;
    const timer = window.setTimeout(() => {
      searchId = crypto.randomUUID();
      invoke<SearchWorkspaceResult>("search_workspace", {
        req: {
          workspaceRoot: rootPath,
          query: text,
          caseSensitive: false,
          wholeWord: false,
          useRegex: false,
          includeGlobs: [],
          excludeGlobs: [],
          searchId,
        },
      })
        .then((found) => live && setResult({ text, matches: found.matches }))
        .catch(() => live && setResult({ text, matches: [] }))
        .finally(() => {
          searchId = null;
        });
    }, TEXT_DELAY_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
      if (searchId) void invoke("cancel_workspace_search", { searchId }).catch(() => {});
    };
  }, [active, rootPath, text]);
  if (!active) return { matches: [], searching: false };
  return result.text === text
    ? { matches: result.matches, searching: false }
    : { matches: [], searching: true };
}
