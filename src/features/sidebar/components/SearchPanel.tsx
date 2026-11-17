import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MagnifyingGlass, Spinner, Warning } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { useEditorStore } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useWorkspaceReplace } from "@/features/sidebar/hooks/useWorkspaceReplace";
import {
  groupSearchResults,
  parsePatterns,
  type SearchQueryState,
  type SearchResult,
  type SearchWorkspaceResult,
} from "@/features/sidebar/lib/searchReplace";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import { useRecentSearches } from "@/features/sidebar/lib/recentSearches";
import { SearchIdle, SearchNoMatches } from "./SearchEmptyState";
import { SearchQueryBar } from "./SearchQueryBar";
import { SearchResultGroupView } from "./SearchResultGroup";

const DEBOUNCE_MS = 300;

export function SearchPanel() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const { openFileByPath } = useFileExplorer();
  const goToPosition = useEditorStore((s) => s.goToPosition);

  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [includePatterns, setIncludePatterns] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceAllOpen, setReplaceAllOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchVersion, setSearchVersion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const recentQueries = useRecentSearches((s) => s.queries);
  const findBinding = useSettingsStore((s) => s.shortcuts["search.findInFiles"]);
  const goToBinding = useSettingsStore((s) => s.shortcuts["file.goToFile"]);
  const isMac = getIsMac();
  const grouped = useMemo(() => groupSearchResults(results, rootPath), [results, rootPath]);
  const searchState = useMemo<SearchQueryState>(
    () => ({
      query,
      replacement,
      caseSensitive,
      wholeWord,
      useRegex,
      includePatterns,
      excludePatterns,
    }),
    [query, replacement, caseSensitive, wholeWord, useRegex, includePatterns, excludePatterns],
  );
  const refreshResults = useCallback(() => {
    setSearchVersion((v) => v + 1);
  }, []);
  const { replacing, replaceOne, replaceAllInFile, replaceAllInWorkspace } = useWorkspaceReplace({
    rootPath,
    state: searchState,
    grouped,
    onRefresh: refreshResults,
  });

  useEffect(() => {
    const handleFocus = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("focus-search", handleFocus);
    return () => window.removeEventListener("focus-search", handleFocus);
  }, []);

  useEffect(() => {
    if (!rootPath) {
      setResults([]);
      setTruncated(false);
      setError(null);
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      setResults([]);
      setTruncated(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let runningSearchId: string | null = null;
    setLoading(true);
    setError(null);

    const timeoutId = window.setTimeout(async () => {
      const searchId = crypto.randomUUID();
      runningSearchId = searchId;
      try {
        const result = await invoke<SearchWorkspaceResult>("search_workspace", {
          req: {
            workspaceRoot: rootPath,
            query: trimmedQuery,
            caseSensitive,
            wholeWord,
            useRegex,
            includeGlobs: parsePatterns(includePatterns),
            excludeGlobs: parsePatterns(excludePatterns),
            searchId,
          },
        });
        if (!controller.signal.aborted) {
          setResults(result.matches);
          setTruncated(result.truncated);
          if (result.matches.length > 0) useRecentSearches.getState().remember(trimmedQuery);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(String(err));
          setResults([]);
          setTruncated(false);
        }
      } finally {
        runningSearchId = null;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
      if (runningSearchId) {
        void invoke("cancel_workspace_search", { searchId: runningSearchId }).catch(() => {});
      }
    };
  }, [
    query,
    caseSensitive,
    wholeWord,
    useRegex,
    includePatterns,
    excludePatterns,
    rootPath,
    searchVersion,
  ]);

  const handleOpenResult = async (result: SearchResult) => {
    await openFileByPath(result.path);
    goToPosition(result.path, { line: result.line, column: result.column });
  };

  if (!rootPath) {
    return (
      <PanelEmptyState
        icon={MagnifyingGlass}
        title="Open a folder to search"
        description="Select a workspace to search across all files."
      />
    );
  }

  const hasQuery = query.trim().length > 0;
  const hasFilters = includePatterns.trim().length > 0 || excludePatterns.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <SearchQueryBar
        inputRef={inputRef}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          if (!next) inputRef.current?.focus();
        }}
        replacement={replacement}
        onReplacementChange={setReplacement}
        caseSensitive={caseSensitive}
        wholeWord={wholeWord}
        useRegex={useRegex}
        onToggleCase={() => setCaseSensitive((v) => !v)}
        onToggleWord={() => setWholeWord((v) => !v)}
        onToggleRegex={() => setUseRegex((v) => !v)}
        showReplace={showReplace}
        onShowReplace={setShowReplace}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((value) => !value)}
        includePatterns={includePatterns}
        onIncludeChange={setIncludePatterns}
        excludePatterns={excludePatterns}
        onExcludeChange={setExcludePatterns}
        summary={{ matches: results.length, files: grouped.length, truncated, loading }}
        canReplaceAll={!replacing && results.length > 0}
        onReplaceAll={() => setReplaceAllOpen(true)}
      />

      {(truncated || error) && (
        <div className="flex shrink-0 flex-col gap-1.5 px-2.5 pb-2">
          {truncated && (
            <Alert>
              <Warning size={16} />
              <AlertDescription className="text-ui-xs">
                Not all matches are shown. Narrow the query or filters to see the rest.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <Warning size={16} />
              <AlertDescription className="text-ui-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {loading && results.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={18} className="animate-spin text-fg-subtle" />
          </div>
        ) : grouped.length === 0 ? (
          hasQuery ? (
            <SearchNoMatches
              query={query.trim()}
              caseSensitive={caseSensitive}
              wholeWord={wholeWord}
              useRegex={useRegex}
              hasFilters={hasFilters}
              onIgnoreCase={() => setCaseSensitive(false)}
              onAnyPart={() => setWholeWord(false)}
              onPlainText={() => setUseRegex(false)}
              onClearFilters={() => {
                setIncludePatterns("");
                setExcludePatterns("");
              }}
            />
          ) : (
            <SearchIdle
              recent={recentQueries}
              onPick={(picked) => {
                setQuery(picked);
                inputRef.current?.focus();
              }}
              findShortcut={formatShortcut(findBinding, isMac)}
              goToShortcut={formatShortcut(goToBinding, isMac)}
            />
          )
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1 px-1.5 pb-2">
              {grouped.map((group) => (
                <SearchResultGroupView
                  key={group.path}
                  group={group}
                  disabled={replacing}
                  showReplace={showReplace}
                  replacement={replacement}
                  caseSensitive={caseSensitive}
                  onOpenResult={handleOpenResult}
                  onReplaceOne={replaceOne}
                  onReplaceAllInFile={replaceAllInFile}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <AlertDialog open={replaceAllOpen} onOpenChange={setReplaceAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all matches?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces {results.length} match{results.length === 1 ? "" : "es"} in{" "}
              {grouped.length} file{grouped.length === 1 ? "" : "s"} across the workspace. Files
              already open in the editor are updated without saving them to disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReplaceAllOpen(false);
                void replaceAllInWorkspace();
              }}
            >
              Replace All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
