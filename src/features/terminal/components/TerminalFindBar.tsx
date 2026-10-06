import { useEffect, useRef, useState } from "react";
import type { ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { ArrowDown, ArrowUp, TextAa, X } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { getXtermTheme } from "@/shared/lib/theme/xterm-theme";

interface TerminalFindBarProps {
  search: SearchAddon | null;
  focusRequest: number;
  onClose: () => void;
}

interface SearchResults {
  index: number;
  count: number;
}

function searchDecorations(): ISearchOptions["decorations"] {
  const theme = getXtermTheme();
  const match = theme.yellow ?? "#e0a94e";
  const active = theme.cursor ?? "#6e7bf2";
  return {
    matchBorder: match,
    matchOverviewRuler: match,
    activeMatchBorder: active,
    activeMatchColorOverviewRuler: active,
  };
}

function resultLabel(results: SearchResults | null, invalid: boolean): string {
  if (invalid) return "Invalid pattern";
  if (!results) return "";
  if (results.count === 0) return "No results";
  if (results.index < 0) return `${results.count}+ results`;
  return `${results.index + 1} of ${results.count}`;
}

export function TerminalFindBar({ search, focusRequest, onClose }: TerminalFindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequest]);

  useEffect(() => {
    if (!search) return;
    const disposable = search.onDidChangeResults(({ resultIndex, resultCount }) => {
      setResults({ index: resultIndex, count: resultCount });
    });
    return () => disposable.dispose();
  }, [search]);

  const find = (direction: "next" | "previous", incremental = false) => {
    if (!search) return;
    setInvalid(false);
    if (!query) {
      search.clearDecorations();
      setResults(null);
      return;
    }
    const options: ISearchOptions = { caseSensitive, regex, decorations: searchDecorations() };
    try {
      if (direction === "next") search.findNext(query, { ...options, incremental });
      else search.findPrevious(query, options);
    } catch {
      search.clearDecorations();
      setResults(null);
      setInvalid(true);
    }
  };

  const findRef = useRef(find);
  findRef.current = find;

  useEffect(() => {
    findRef.current("next", true);
  }, [query, caseSensitive, regex, search]);

  return (
    <div className="absolute right-4 top-3 z-20 flex items-center gap-1 rounded-md border border-border bg-bg-elevated p-1 shadow-md">
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            find(event.shiftKey ? "previous" : "next");
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="Find"
        aria-label="Find in terminal"
        aria-invalid={invalid || undefined}
        className="h-6 w-44"
      />
      <span className="min-w-16 px-1 text-center text-ui-xs text-fg-muted">
        {resultLabel(results, invalid)}
      </span>
      <Button
        variant={caseSensitive ? "secondary" : "ghost"}
        size="icon-sm"
        aria-pressed={caseSensitive}
        onClick={() => setCaseSensitive((value) => !value)}
        title="Match Case"
      >
        <TextAa size={13} />
      </Button>
      <Button
        variant={regex ? "secondary" : "ghost"}
        size="icon-sm"
        aria-pressed={regex}
        onClick={() => setRegex((value) => !value)}
        title="Use Regular Expression"
        className="font-mono text-ui-xs"
      >
        .*
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => find("previous")}
        title="Previous Match"
      >
        <ArrowUp size={13} />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => find("next")} title="Next Match">
        <ArrowDown size={13} />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
        <X size={13} />
      </Button>
    </div>
  );
}
