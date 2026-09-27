import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowsLeftRight,
  BracketsAngle,
  Funnel,
  MagnifyingGlass,
  Quotes,
  Spinner,
  TextAa,
  Warning,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Input } from "@/shared/components/ui/input";
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
} from "@/features/sidebar/lib/searchReplace";
import { cn } from "@/shared/lib/utils";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceAllOpen, setReplaceAllOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchVersion, setSearchVersion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
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
      setError(null);
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const matches = await invoke<SearchResult[]>("search_workspace", {
          req: {
            workspaceRoot: rootPath,
            query: trimmedQuery,
            caseSensitive,
            wholeWord,
            useRegex,
            includeGlobs: parsePatterns(includePatterns),
            excludeGlobs: parsePatterns(excludePatterns),
          },
        });
        if (!controller.signal.aborted) {
          setResults(matches);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(String(err));
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
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

  const emptyTitle = query.trim().length > 0 ? "No results" : "Search your workspace";
  const emptyDescription =
    query.trim().length > 0
      ? "Try a different query or adjust the filters."
      : "Find text across every file. Use the toggles for case, whole word or regex.";
  const activeFilters = (includePatterns.trim() ? 1 : 0) + (excludePatterns.trim() ? 1 : 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 px-2.5 pt-1.5 pb-2">
        <div className={FIELD_CLASS}>
          <MagnifyingGlass size={14} className="shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in files"
            aria-label="Search in workspace"
            className="min-w-0 flex-1 bg-transparent text-ui-sm text-fg-default outline-none placeholder:text-fg-subtle"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex size-5 shrink-0 items-center justify-center rounded text-fg-subtle hover:text-fg-default"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {showReplace && (
          <div className={FIELD_CLASS}>
            <ArrowsLeftRight size={14} className="shrink-0 text-fg-subtle" />
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replace with"
              aria-label="Replace with"
              className="min-w-0 flex-1 bg-transparent text-ui-sm text-fg-default outline-none placeholder:text-fg-subtle"
            />
            <button
              type="button"
              onClick={() => setReplaceAllOpen(true)}
              disabled={replacing || results.length === 0}
              title="Replace all matches"
              aria-label="Replace all matches"
              className="flex h-5 shrink-0 items-center rounded px-1.5 text-ui-2xs font-medium text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:pointer-events-none disabled:opacity-40"
            >
              Replace all
            </button>
          </div>
        )}

        {showFilters && (
          <div className="flex flex-col gap-1.5">
            <Input
              value={includePatterns}
              onChange={(e) => setIncludePatterns(e.target.value)}
              placeholder="Files to include, e.g. src/**/*.ts"
              className="h-7 rounded-md text-ui-xs"
            />
            <Input
              value={excludePatterns}
              onChange={(e) => setExcludePatterns(e.target.value)}
              placeholder="Files to exclude, e.g. *.test.ts"
              className="h-7 rounded-md text-ui-xs"
            />
          </div>
        )}

        <div className="flex items-center gap-0.5">
          <OptionButton
            active={caseSensitive}
            onClick={() => setCaseSensitive((v) => !v)}
            title="Match case"
            icon={TextAa}
          />
          <OptionButton
            active={wholeWord}
            onClick={() => setWholeWord((v) => !v)}
            title="Match whole word"
            icon={Quotes}
          />
          <OptionButton
            active={useRegex}
            onClick={() => setUseRegex((v) => !v)}
            title="Use regular expressions"
            icon={BracketsAngle}
          />
          <span aria-hidden="true" className="mx-1 h-3.5 w-px bg-border" />
          <OptionButton
            active={showReplace}
            onClick={() => setShowReplace((value) => !value)}
            title={showReplace ? "Hide replace" : "Show replace"}
            icon={ArrowsLeftRight}
          />
          <OptionButton
            active={showFilters || activeFilters > 0}
            onClick={() => setShowFilters((value) => !value)}
            title="Include and exclude filters"
            icon={Funnel}
          />
          {results.length > 0 && (
            <span className="ml-auto truncate pl-2 text-ui-2xs text-fg-subtle tabular-nums">
              {results.length} in {grouped.length} file{grouped.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <Warning size={16} />
            <AlertDescription className="text-ui-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {loading && results.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={18} className="animate-spin text-fg-subtle" />
          </div>
        ) : grouped.length === 0 ? (
          <PanelEmptyState
            icon={MagnifyingGlass}
            title={emptyTitle}
            description={emptyDescription}
            className="py-4"
          />
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1 px-1.5 pb-2">
              {grouped.map((group) => (
                <SearchResultGroupView
                  key={group.path}
                  group={group}
                  disabled={replacing}
                  showReplace={showReplace}
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

const FIELD_CLASS =
  "flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-border bg-bg-input pr-1 pl-2.5 transition-colors focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_var(--color-accent-subtle)]";

function OptionButton({
  active,
  onClick,
  title,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: Icon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent-subtle text-primary"
          : "text-fg-subtle hover:bg-bg-hover hover:text-fg-default",
      )}
    >
      <Icon size={13} weight={active ? "bold" : "regular"} />
    </button>
  );
}
