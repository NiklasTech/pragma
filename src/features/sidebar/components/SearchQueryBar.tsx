import { useRef, type Ref } from "react";
import { X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

const FIELD =
  "flex h-8 min-w-0 items-center gap-2 rounded-[6px] pr-1 pl-2.5 ring-1 ring-fg-default/15 ring-inset transition-[box-shadow] duration-(--motion-fast) hover:ring-fg-default/30 focus-within:ring-primary/60";
const BARE_INPUT =
  "h-auto min-w-0 flex-1 rounded-none bg-transparent p-0 font-mono text-ui-sm ring-0 hover:ring-0 focus-visible:ring-0";

/// A mono key inside the field that lights up while its option is on.
function OptionKey({
  label,
  title,
  active,
  onToggle,
}: {
  label: string;
  title: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={onToggle}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "h-5.5 min-w-6 px-1.5 font-mono text-[11px] ring-1 ring-inset",
        active
          ? "bg-primary/12 text-fg-default ring-primary/50 hover:bg-primary/18"
          : "text-fg-subtle ring-transparent hover:ring-fg-default/20",
      )}
    >
      {label}
    </Button>
  );
}

/// A word in the mode row; the chosen one is underlined in Pragma orange.
function ModeWord({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "h-6 rounded-none border-b-2 px-0.5 font-mono text-[11.5px] hover:bg-transparent",
        active ? "border-primary text-fg-default" : "border-transparent text-fg-subtle",
      )}
    >
      {children}
    </Button>
  );
}

export interface SearchQueryBarProps {
  inputRef: Ref<HTMLInputElement>;
  query: string;
  onQueryChange: (query: string) => void;
  replacement: string;
  onReplacementChange: (replacement: string) => void;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  onToggleCase: () => void;
  onToggleWord: () => void;
  onToggleRegex: () => void;
  showReplace: boolean;
  onShowReplace: (show: boolean) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  includePatterns: string;
  onIncludeChange: (patterns: string) => void;
  excludePatterns: string;
  onExcludeChange: (patterns: string) => void;
  /** Matches found, files they are in, whether the list is cut short and whether a search runs. */
  summary: { matches: number; files: number; truncated: boolean; loading: boolean };
  canReplaceAll: boolean;
  onReplaceAll: () => void;
}

/// The query line of Search: a "/" prompt with its options as keys, then find or replace and filters.
export function SearchQueryBar(props: SearchQueryBarProps) {
  const filterCount =
    (props.includePatterns.trim() ? 1 : 0) + (props.excludePatterns.trim() ? 1 : 0);
  const replaceRef = useRef<HTMLInputElement>(null);
  const { summary } = props;

  return (
    <div className="flex shrink-0 flex-col gap-2 px-2.5 pt-2 pb-2.5">
      <div className={FIELD}>
        <span aria-hidden="true" className="font-mono text-ui-sm font-semibold text-primary">
          /
        </span>
        <Input
          ref={props.inputRef}
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="search every file"
          aria-label="Search in workspace"
          className={BARE_INPUT}
        />
        {props.query.length > 0 && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => props.onQueryChange("")}
            className="text-fg-subtle"
            aria-label="Clear search"
          >
            <X size={12} />
          </Button>
        )}
        <span className="flex items-center gap-0.5">
          <OptionKey
            label="Aa"
            title="Match case"
            active={props.caseSensitive}
            onToggle={props.onToggleCase}
          />
          <OptionKey
            label="\b"
            title="Match whole word"
            active={props.wholeWord}
            onToggle={props.onToggleWord}
          />
          <OptionKey
            label=".*"
            title="Use regular expressions"
            active={props.useRegex}
            onToggle={props.onToggleRegex}
          />
        </span>
      </div>

      {props.showReplace && (
        <div className={FIELD}>
          <span
            aria-hidden="true"
            className="font-mono text-ui-sm font-semibold text-status-success"
          >
            ↳
          </span>
          <Input
            ref={replaceRef}
            value={props.replacement}
            onChange={(event) => props.onReplacementChange(event.target.value)}
            placeholder="replace with"
            aria-label="Replace with"
            className={BARE_INPUT}
          />
          <Button
            variant="outline"
            size="xs"
            onClick={props.onReplaceAll}
            disabled={!props.canReplaceAll}
            className="h-5.5"
          >
            replace all
          </Button>
        </div>
      )}

      {props.showFilters && (
        <div className="flex flex-col gap-1.5">
          <label className={cn(FIELD, "h-7")}>
            <span className="w-7 font-mono text-[11px] text-fg-subtle">in</span>
            <Input
              value={props.includePatterns}
              onChange={(event) => props.onIncludeChange(event.target.value)}
              placeholder="src/**/*.ts"
              aria-label="Files to include"
              className={cn(BARE_INPUT, "text-ui-xs")}
            />
          </label>
          <label className={cn(FIELD, "h-7")}>
            <span className="w-7 font-mono text-[11px] text-fg-subtle">not</span>
            <Input
              value={props.excludePatterns}
              onChange={(event) => props.onExcludeChange(event.target.value)}
              placeholder="*.test.ts, dist"
              aria-label="Files to exclude"
              className={cn(BARE_INPUT, "text-ui-xs")}
            />
          </label>
        </div>
      )}

      <div className="flex min-w-0 items-center gap-3 px-0.5">
        <ModeWord
          active={!props.showReplace}
          onClick={() => props.onShowReplace(false)}
          title="Find only"
        >
          find
        </ModeWord>
        <ModeWord
          active={props.showReplace}
          onClick={() => {
            props.onShowReplace(true);
            requestAnimationFrame(() => replaceRef.current?.focus());
          }}
          title="Replace matches"
        >
          replace
        </ModeWord>
        <ModeWord
          active={props.showFilters}
          onClick={props.onToggleFilters}
          title="Include and exclude files"
        >
          filter{filterCount > 0 ? ` ${filterCount}` : ""}
        </ModeWord>
        <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate font-mono text-[11px] text-fg-subtle tabular-nums">
          {summary.loading && (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 animate-pulse rounded-[1px] bg-primary"
            />
          )}
          {summary.matches > 0 && (
            <span className="truncate">
              <span className="text-fg-default">
                {summary.matches}
                {summary.truncated ? "+" : ""}
              </span>{" "}
              in {summary.files} file{summary.files === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
