import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowsLeftRight,
  BracketsAngle,
  File,
  MagnifyingGlass,
  Quotes,
  Spinner,
  TextAa,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
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
import { PanelHeader } from "@/shared/components/PanelHeader";
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
  type SearchResultGroup,
} from "@/features/sidebar/lib/searchReplace";
import { cn } from "@/shared/lib/utils";

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

  const emptyTitle = query.trim().length > 0 ? "No results" : "Type to search";
  const emptyDescription =
    query.trim().length > 0
      ? "Try a different query or adjust filters."
      : "Start typing to search across files.";

  return (
    <div className="flex h-full flex-col">
      <PanelHeader icon={MagnifyingGlass} title="Search" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in workspace"
            className="h-8 pl-8 pr-7"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-subtle hover:text-fg-default"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
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
        </div>

        <div className="relative">
          <ArrowsLeftRight
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace"
            className="h-8 pl-8 pr-7"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            value={includePatterns}
            onChange={(e) => setIncludePatterns(e.target.value)}
            placeholder="Include (e.g. *.ts)"
            className="h-7 text-ui-xs"
          />
          <Input
            value={excludePatterns}
            onChange={(e) => setExcludePatterns(e.target.value)}
            placeholder="Exclude (e.g. *.test.ts)"
            className="h-7 text-ui-xs"
          />
        </div>

        {error && <p className="text-ui-xs text-status-error">{error}</p>}

        <div className="min-h-0 flex-1">
          {loading && results.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size={20} className="animate-spin text-fg-muted" />
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
              <div className="flex flex-col gap-3 pb-2">
                {grouped.map((group) => (
                  <ResultGroupView
                    key={group.path}
                    group={group}
                    disabled={replacing}
                    onOpenResult={handleOpenResult}
                    onReplaceOne={replaceOne}
                    onReplaceAllInFile={replaceAllInFile}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {results.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui-xs text-fg-subtle">
              {results.length} result{results.length === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setReplaceAllOpen(true)}
              disabled={replacing}
            >
              <ArrowsLeftRight size={12} className="mr-1" />
              Replace All
            </Button>
          </div>
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
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      title={title}
      className={cn(active && "bg-bg-active text-primary")}
    >
      <Icon size={14} weight={active ? "bold" : "regular"} />
    </Button>
  );
}

function ResultGroupView({
  group,
  disabled,
  onOpenResult,
  onReplaceOne,
  onReplaceAllInFile,
}: {
  group: SearchResultGroup;
  disabled: boolean;
  onOpenResult: (result: SearchResult) => void;
  onReplaceOne: (result: SearchResult) => void;
  onReplaceAllInFile: (path: string) => void;
}) {
  const fileName = group.relativePath.split(/[/\\]/).pop() ?? group.relativePath;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 px-1 py-0.5 text-ui-xs text-fg-default">
        <File size={12} className="shrink-0 text-fg-muted" />
        <span className="truncate font-medium" title={group.relativePath}>
          {fileName}
        </span>
        <span className="truncate text-fg-subtle">{group.relativePath}</span>
        <button
          type="button"
          onClick={() => onReplaceAllInFile(group.path)}
          disabled={disabled}
          title={`Replace all matches in ${fileName}`}
          className="shrink-0 rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg-default disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowsLeftRight size={12} />
        </button>
      </div>
      {group.matches.map((match, index) => (
        <div
          key={`${match.line}:${match.column}:${index}`}
          className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-bg-hover"
        >
          <button
            type="button"
            onClick={() => onOpenResult(match)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-ui-xs"
          >
            <span className="w-8 shrink-0 text-right text-fg-subtle tabular-nums">
              {match.line}
            </span>
            <span className="truncate text-fg-default">{match.preview}</span>
          </button>
          <button
            type="button"
            onClick={() => onReplaceOne(match)}
            disabled={disabled}
            title={`Replace this match in ${fileName}`}
            className="shrink-0 rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg-default disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowsLeftRight size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
