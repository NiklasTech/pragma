import { useState } from "react";
import { ArrowsLeftRight, CaretRight } from "@phosphor-icons/react";

import { getFileIconPath } from "@/shared/lib/file-icons";
import { cn } from "@/shared/lib/utils";
import type { SearchResult, SearchResultGroup } from "@/features/sidebar/lib/searchReplace";

const LEADING_CONTEXT = 28;

function splitPreview(result: SearchResult, caseSensitive: boolean) {
  const preview = result.preview.trimStart();
  const haystack = caseSensitive ? preview : preview.toLowerCase();
  const needle = caseSensitive ? result.matchText : result.matchText.toLowerCase();
  const index = needle ? haystack.indexOf(needle) : -1;
  if (index < 0) return { before: preview, match: "", after: "" };

  const rawBefore = preview.slice(0, index);
  const before =
    rawBefore.length > LEADING_CONTEXT ? `…${rawBefore.slice(-LEADING_CONTEXT)}` : rawBefore;
  return {
    before,
    match: preview.slice(index, index + result.matchText.length),
    after: preview.slice(index + result.matchText.length),
  };
}

interface SearchResultGroupViewProps {
  group: SearchResultGroup;
  disabled: boolean;
  showReplace: boolean;
  caseSensitive: boolean;
  onOpenResult: (result: SearchResult) => void;
  onReplaceOne: (result: SearchResult) => void;
  onReplaceAllInFile: (path: string) => void;
}

export function SearchResultGroupView({
  group,
  disabled,
  showReplace,
  caseSensitive,
  onOpenResult,
  onReplaceOne,
  onReplaceAllInFile,
}: SearchResultGroupViewProps) {
  const [open, setOpen] = useState(true);
  const segments = group.relativePath.split(/[/\\]/);
  const fileName = segments.pop() ?? group.relativePath;
  const directory = segments.join("/");

  return (
    <div className="flex flex-col">
      <div className="group/file flex h-7 items-center gap-1.5 rounded-md pr-1 pl-1 hover:bg-bg-hover">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-ui-xs"
          title={group.relativePath}
        >
          <CaretRight
            size={10}
            weight="bold"
            className={cn("shrink-0 text-fg-subtle transition-transform", open && "rotate-90")}
          />
          <img src={getFileIconPath(fileName)} alt="" className="size-3.5 shrink-0" />
          <span className="shrink-0 font-medium text-fg-default">{fileName}</span>
          {directory && <span className="min-w-0 truncate text-fg-subtle">{directory}</span>}
        </button>
        {showReplace && (
          <button
            type="button"
            onClick={() => onReplaceAllInFile(group.path)}
            disabled={disabled}
            title={`Replace all matches in ${fileName}`}
            aria-label={`Replace all matches in ${fileName}`}
            className="hidden size-5 shrink-0 items-center justify-center rounded text-fg-subtle group-hover/file:flex hover:bg-bg-hover hover:text-fg-default disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowsLeftRight size={12} />
          </button>
        )}
        <span className="shrink-0 rounded-full bg-bg-hover px-1.5 text-ui-2xs text-fg-muted tabular-nums">
          {group.matches.length}
        </span>
      </div>

      {open &&
        group.matches.map((match, index) => {
          const { before, match: hit, after } = splitPreview(match, caseSensitive);
          return (
            <div
              key={`${match.line}:${match.column}:${index}`}
              className="group/match flex h-6 items-center gap-1 rounded-md pr-1 pl-6 hover:bg-bg-hover"
            >
              <button
                type="button"
                onClick={() => onOpenResult(match)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-ui-xs"
                title={`Line ${match.line}`}
              >
                <span className="min-w-0 truncate text-fg-muted">
                  {before}
                  {hit && (
                    <mark className="rounded-sm bg-accent-subtle px-px text-fg-default">{hit}</mark>
                  )}
                  {after}
                </span>
                <span className="ml-auto shrink-0 text-ui-2xs text-fg-subtle tabular-nums">
                  {match.line}
                </span>
              </button>
              {showReplace && (
                <button
                  type="button"
                  onClick={() => onReplaceOne(match)}
                  disabled={disabled}
                  title={`Replace this match in ${fileName}`}
                  aria-label={`Replace this match in ${fileName}`}
                  className="hidden size-5 shrink-0 items-center justify-center rounded text-fg-subtle group-hover/match:flex hover:bg-bg-hover hover:text-fg-default disabled:pointer-events-none disabled:opacity-40"
                >
                  <ArrowsLeftRight size={12} />
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
}
