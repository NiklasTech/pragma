import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
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
import { PanelHeader } from "@/shared/components/PanelHeader";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { useEditorStore } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { cn } from "@/shared/lib/utils";

interface SearchResult {
  path: string;
  line: number;
  column: number;
  preview: string;
  matchText: string;
}

interface ResultGroup {
  path: string;
  relativePath: string;
  matches: SearchResult[];
}

const DEBOUNCE_MS = 300;

function parsePatterns(value: string): string[] {
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function groupResults(results: SearchResult[], rootPath: string | null): ResultGroup[] {
  const map = new Map<string, SearchResult[]>();
  for (const result of results) {
    const list = map.get(result.path) ?? [];
    list.push(result);
    map.set(result.path, list);
  }

  const groups: ResultGroup[] = [];
  for (const [path, matches] of map.entries()) {
    const relativePath = rootPath ? path.replace(rootPath, "").replace(/^[/\\]/, "") : path;
    groups.push({ path, relativePath, matches });
  }
  groups.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return groups;
}

export function SearchPanel() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const { openFileByPath } = useFileExplorer();
  const goToPosition = useEditorStore((s) => s.goToPosition);

  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [includePatterns, setIncludePatterns] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [query, caseSensitive, wholeWord, useRegex, includePatterns, excludePatterns, rootPath]);

  const grouped = useMemo(() => groupResults(results, rootPath), [results, rootPath]);

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
                  <ResultGroupView key={group.path} group={group} onOpenResult={handleOpenResult} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {results.length > 0 && (
          <p className="text-ui-xs text-fg-subtle">
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
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
  onOpenResult,
}: {
  group: ResultGroup;
  onOpenResult: (result: SearchResult) => void;
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
      </div>
      {group.matches.map((match, index) => (
        <button
          key={`${match.line}:${match.column}:${index}`}
          type="button"
          onClick={() => onOpenResult(match)}
          className="flex flex-col gap-0.5 rounded-md px-1 py-1 text-left text-ui-xs hover:bg-bg-hover"
        >
          <div className="flex items-center gap-2 text-fg-subtle">
            <span className="w-8 shrink-0 text-right tabular-nums">{match.line}</span>
            <span className="truncate text-fg-default">{match.preview}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
